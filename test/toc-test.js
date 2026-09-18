import { buildToc, findAnchors, findMarkers, renderToc } from '@0dep/toc';

const EMPTY_BLOCK = ['<!-- toc -->', '<!-- /toc -->'];

/** @param {string[]} before @param {string[]} after */
function doc(before, after) {
  return [...before, ...EMPTY_BLOCK, ...after, ''].join('\n');
}

/** @param {string[]} before @param {string[]} toc @param {string[]} after */
function expected(before, toc, after) {
  return [...before, '<!-- toc -->', '', ...toc, '', '<!-- /toc -->', ...after, ''].join('\n');
}

describe('buildToc', () => {
  describe('markers', () => {
    it('returns the source unchanged when there are no markers', () => {
      const source = '# Title\n\n## Install\n\n## Usage\n';
      expect(buildToc(source)).to.equal(source);
    });

    it('returns the source unchanged when only the start marker exists', () => {
      const source = '# Title\n\n<!-- toc -->\n\n## Install\n';
      expect(buildToc(source)).to.equal(source);
    });

    it('returns the source unchanged when only the end marker exists', () => {
      const source = '# Title\n\n<!-- /toc -->\n\n## Install\n';
      expect(buildToc(source)).to.equal(source);
    });

    it('returns the source unchanged when the end marker comes before the start marker', () => {
      const source = '# Title\n\n<!-- /toc -->\n\n<!-- toc -->\n\n## Install\n';
      expect(buildToc(source)).to.equal(source);
    });

    it('ignores markers inside fenced code blocks', () => {
      const source = ['# Title', '', '```md', '<!-- toc -->', '<!-- /toc -->', '```', '', '## Usage', ''].join('\n');
      expect(buildToc(source)).to.equal(source);
    });

    it('uses the first start marker and the first end marker after it', () => {
      const source = ['# Title', '', '<!-- /toc -->', '<!-- toc -->', 'stale', '<!-- /toc -->', '', '## A', '', '<!-- /toc -->', ''].join(
        '\n',
      );
      expect(buildToc(source)).to.equal(
        ['# Title', '', '<!-- /toc -->', '<!-- toc -->', '', '- [A](#a)', '', '<!-- /toc -->', '', '## A', '', '<!-- /toc -->', ''].join(
          '\n',
        ),
      );
    });

    it('replaces the block in place and is idempotent', () => {
      const source = ['# Title', '', '<!-- toc -->', '', '- [Stale](#stale)', '', '<!-- /toc -->', '', '## Fresh', ''].join('\n');
      const once = buildToc(source);
      expect(once).to.equal(expected(['# Title', ''], ['- [Fresh](#fresh)'], ['', '## Fresh']));
      expect(buildToc(once)).to.equal(once);
    });

    it('updates every marker pair, each listing everything below its own start marker', () => {
      const source = [
        '# Title',
        '',
        ...EMPTY_BLOCK,
        '',
        '## API',
        '',
        ...EMPTY_BLOCK,
        '',
        '### get',
        '',
        '### set',
        '',
        '## License',
        '',
      ].join('\n');
      expect(buildToc(source)).to.equal(
        [
          '# Title',
          '',
          '<!-- toc -->',
          '',
          '- [API](#api)',
          '  - [get](#get)',
          '  - [set](#set)',
          '- [License](#license)',
          '',
          '<!-- /toc -->',
          '',
          '## API',
          '',
          '<!-- toc -->',
          '',
          '- [get](#get)',
          '- [set](#set)',
          '- [License](#license)',
          '',
          '<!-- /toc -->',
          '',
          '### get',
          '',
          '### set',
          '',
          '## License',
          '',
        ].join('\n'),
      );
    });

    it('leaves a pair without headings below it alone while updating the others', () => {
      const source = ['# Title', '', ...EMPTY_BLOCK, '', '## Last', '', '<!-- toc -->', 'kept', '<!-- /toc -->', ''].join('\n');
      expect(buildToc(source)).to.equal(
        [
          '# Title',
          '',
          '<!-- toc -->',
          '',
          '- [Last](#last)',
          '',
          '<!-- /toc -->',
          '',
          '## Last',
          '',
          '<!-- toc -->',
          'kept',
          '<!-- /toc -->',
          '',
        ].join('\n'),
      );
    });

    it('updates the complete pairs and leaves an unbalanced one alone', () => {
      const source = ['# Title', '', '<!-- /toc -->', '', ...EMPTY_BLOCK, '', '## A', '', '<!-- toc -->', '', '## B', ''].join('\n');
      expect(buildToc(source)).to.equal(
        [
          '# Title',
          '',
          '<!-- /toc -->',
          '',
          '<!-- toc -->',
          '',
          '- [A](#a)',
          '- [B](#b)',
          '',
          '<!-- /toc -->',
          '',
          '## A',
          '',
          '<!-- toc -->',
          '',
          '## B',
          '',
        ].join('\n'),
      );
    });

    it('returns the source unchanged when there are no headings below the start marker', () => {
      const source = ['# Title', '', '## Above', '', '<!-- toc -->', '', '- [Above](#above)', '', '<!-- /toc -->', '', 'text', ''].join(
        '\n',
      );
      expect(buildToc(source)).to.equal(source);
    });
  });

  describe('line endings', () => {
    it('keeps CRLF line endings throughout and stays idempotent', () => {
      const source = ['# Title', '', '<!-- toc collapsed -->', '<!-- /toc -->', '', '## One', '', '### Two', ''].join('\r\n');
      const once = buildToc(source);
      expect(once).to.equal(
        [
          '# Title',
          '',
          '<!-- toc collapsed -->',
          '<details>',
          '<summary>Table of contents</summary>',
          '',
          '- [One](#one)',
          '  - [Two](#two)',
          '',
          '</details>',
          '<!-- /toc -->',
          '',
          '## One',
          '',
          '### Two',
          '',
        ].join('\r\n'),
      );
      expect(once).to.not.include('\n\n\r');
      expect(buildToc(once)).to.equal(once);
      expect(findMarkers(source)).to.deep.equal([{ start: 2, end: 3, options: { collapsed: true } }]);
      expect(renderToc(source, 2)).to.equal('<!-- toc -->\r\n\r\n- [One](#one)\r\n  - [Two](#two)\r\n\r\n<!-- /toc -->');
    });

    it('ignores a byte order mark, lists what follows it on the first line, and keeps it', () => {
      const bom = '\uFEFF';
      const source = `${bom}# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n`;
      const once = buildToc(source);
      expect(once).to.equal(`${bom}# Title\n\n<!-- toc -->\n\n- [One](#one)\n\n<!-- /toc -->\n\n## One\n`);
      expect(buildToc(once)).to.equal(once);
      expect(renderToc(source)).to.equal('<!-- toc -->\n\n- [Title](#title)\n  - [One](#one)\n\n<!-- /toc -->');
      expect(findMarkers(`${bom}<!-- toc -->\n<!-- /toc -->\n\n## One\n`)).to.deep.equal([{ start: 0, end: 1, options: {} }]);
      expect(buildToc(`${bom}<!-- toc -->\n<!-- /toc -->\n\n## One\n`)).to.equal(
        `${bom}<!-- toc -->\n\n- [One](#one)\n\n<!-- /toc -->\n\n## One\n`,
      );
    });
  });

  describe('headings', () => {
    it('lists every heading below the start marker, level 1 included, and nothing above it', () => {
      const source = doc(['# Title', '', '## Above', ''], ['', '# Part one', '', '## Chapter', '', '### Section', '', '# Part two']);
      expect(buildToc(source)).to.equal(
        expected(
          ['# Title', '', '## Above', ''],
          ['- [Part one](#part-one)', '  - [Chapter](#chapter)', '    - [Section](#section)', '- [Part two](#part-two)'],
          ['', '# Part one', '', '## Chapter', '', '### Section', '', '# Part two'],
        ),
      );
    });

    it('indents relative to the shallowest level listed so far, so the list never starts indented', () => {
      const source = doc(['# Title'], ['', '### Deep', '', '#### Deeper', '', '### Deep again']);
      expect(buildToc(source)).to.include(['- [Deep](#deep)', '  - [Deeper](#deeper)', '- [Deep again](#deep-again)'].join('\n'));
      const shallower = doc(['# Title'], ['', '### a', '', '#### b', '', '## c', '', '### d']);
      expect(buildToc(shallower)).to.include(['- [a](#a)', '  - [b](#b)', '- [c](#c)', '  - [d](#d)'].join('\n'));
    });

    it('ignores headings inside fenced code blocks', () => {
      const source = doc([], ['', '## Real', '', '```md', '## Not a heading', '```', '', '~~~', '# Nope', '~~~', '', '## Also real']);
      const toc = buildToc(source);
      expect(toc).to.include('- [Real](#real)\n- [Also real](#also-real)');
      expect(toc).to.not.include('#not-a-heading');
      expect(toc).to.not.include('#nope');
    });

    it('closes a fence only with the same character and at least the same length', () => {
      const source = doc([], ['', '````', '```', '## Inside', '````', '', '## Outside']);
      const toc = buildToc(source);
      expect(toc).to.not.include('#inside');
      expect(toc).to.include('- [Outside](#outside)');
    });

    it('does not treat a backtick fence with backticks in the info string as a fence', () => {
      const source = doc([], ['', '``` a`b', '## Listed']);
      expect(buildToc(source)).to.include('- [Listed](#listed)');
    });

    it('supports setext headings', () => {
      const source = doc(['Title', '=====', ''], ['', 'Section', '-------', '', 'Part two', '===']);
      expect(buildToc(source)).to.include(['- [Section](#section)', '- [Part two](#part-two)'].join('\n'));
    });

    it('does not treat a thematic break or list underline as a setext heading', () => {
      const source = doc([], ['', '## Real', '', '- item', '---', '', '', '---']);
      expect(buildToc(source)).to.include('<!-- toc -->\n\n- [Real](#real)\n\n<!-- /toc -->');
    });

    it('dedupes slugs github style', () => {
      const source = doc([], ['', '## Same', '', '## Same', '', '## Same 1', '', '## Same']);
      expect(buildToc(source)).to.include(
        ['- [Same](#same)', '- [Same](#same-1)', '- [Same 1](#same-1-1)', '- [Same](#same-2)'].join('\n'),
      );
    });

    it('numbers duplicate slugs over the whole document, headings above the marker included, like GitHub', () => {
      const source = doc(['# Options', '', '## Same'], ['', '## Options', '', '## Same', '', '### Options']);
      expect(buildToc(source)).to.include(['- [Options](#options-1)', '- [Same](#same-1)', '  - [Options](#options-2)'].join('\n'));
      expect(renderToc(source, 3)).to.include('- [Options](#options-1)');
    });

    it('keeps inline markdown in the label but flattens links', () => {
      const source = doc([], ['', '## Use `code` and **bold** with [a link](http://x.y)']);
      expect(buildToc(source)).to.include('- [Use `code` and **bold** with a link](#use-code-and-bold-with-a-link)');
    });

    it('flattens autolinks in the label to their url, a link cannot nest inside the toc link', () => {
      const source = doc([], ['', '## <https://example.local>', '', '## Mail <mailto:hi@example.local> now']);
      const toc = buildToc(source);
      expect(toc).to.include('- [https://example.local](#httpsexamplelocal)');
      expect(toc).to.include('- [Mail mailto:hi@example.local now](#mail-mailtohiexamplelocal-now)');
    });

    it('strips closing hashes from the label', () => {
      expect(buildToc(doc([], ['## Closed ##']))).to.include('- [Closed](#closed)');
    });

    it('accepts up to three leading spaces and requires a space after the hashes', () => {
      const source = doc([], ['', '   ## Indented', '', '    ## Code block', '', '##NoSpace']);
      const toc = buildToc(source);
      expect(toc).to.include('- [Indented](#indented)');
      expect(toc).to.not.include('code-block');
      expect(toc).to.not.include('nospace');
    });
  });
});

describe('renderToc', () => {
  it('renders every heading by default, so the block can be pasted into a document without markers', () => {
    expect(renderToc('# Title\n\n## One\n')).to.equal('<!-- toc -->\n\n- [Title](#title)\n  - [One](#one)\n\n<!-- /toc -->');
  });

  it('renders the headings below the given line', () => {
    const source = ['# Title', '', '## Above', '', '<!-- toc -->', '<!-- /toc -->', '', '## One', '', '### Two', ''].join('\n');
    expect(renderToc(source, 4)).to.equal('<!-- toc -->\n\n- [One](#one)\n  - [Two](#two)\n\n<!-- /toc -->');
  });

  it('returns an empty string when nothing is listed', () => {
    expect(renderToc('text\n')).to.equal('');
    expect(renderToc('# Title\n\ntext\n', 0)).to.equal('');
  });

  it('is what buildToc puts in the markdown', () => {
    const source = doc(['# Title'], ['', '## One']);
    expect(buildToc(source)).to.include(renderToc(source, 1));
  });
});

describe('scan cache', () => {
  it('reuses the scan of the last source, so the bin walks a file once for all its calls', () => {
    const source = '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n[x](#one)\n';
    expect(findMarkers(source)).to.equal(findMarkers(source));
    expect(findAnchors(source)).to.equal(findAnchors(source));
    expect(findMarkers(`${source}\n`)).to.not.equal(findMarkers(source));
  });
});

describe('findMarkers', () => {
  it('returns the zero based line numbers of each start marker and the first end marker after it', () => {
    const source = ['# Title', '', '<!-- toc -->', '', '<!-- /toc -->', '', '## A', '<!-- toc -->', '<!-- /toc -->', ''].join('\n');
    expect(findMarkers(source)).to.deep.equal([
      { start: 2, end: 4, options: {} },
      { start: 7, end: 8, options: {} },
    ]);
  });

  it('returns an empty array without markers', () => {
    expect(findMarkers('# Title\n')).to.deep.equal([]);
  });

  it('reports a start marker without an end marker with end -1', () => {
    expect(findMarkers('# Title\n<!-- toc -->\n')).to.deep.equal([{ start: 1, end: -1, options: {} }]);
  });

  it('reports an end marker without a start marker with start -1', () => {
    expect(findMarkers('# Title\n<!-- /toc -->\n<!-- toc -->\n<!-- /toc -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: -1, end: 1, options: {} },
      { start: 2, end: 3, options: {} },
      { start: -1, end: 4, options: {} },
    ]);
  });

  it('treats a start marker inside an open pair as content', () => {
    expect(findMarkers('<!-- toc -->\n<!-- toc -->\n<!-- /toc -->\n')).to.deep.equal([{ start: 0, end: 2, options: {} }]);
  });

  it('ignores markers inside fenced code blocks', () => {
    expect(findMarkers('```\n<!-- toc -->\n<!-- /toc -->\n```\n')).to.deep.equal([]);
  });

  it('accepts a start marker without a space before the closing', () => {
    expect(findMarkers('<!-- toc-->\n<!-- /toc -->\n')).to.deep.equal([{ start: 0, end: 1, options: {} }]);
  });

  it('parses options on the start marker', () => {
    expect(findMarkers('<!-- toc collapsible -->\n<!-- /toc -->\n')).to.deep.equal([{ start: 0, end: 1, options: { collapsible: true } }]);
    expect(findMarkers('<!--  toc   collapsible="My contents"  -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsible: 'My contents' } },
    ]);
  });

  it('reports unknown options and garbage as a problem instead of guessing', () => {
    expect(findMarkers('<!-- toc collapsible foo bar="1" -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsible: true, attributes: { bar: '1' } }, problem: 'unknown TOC option foo' },
    ]);
    expect(findMarkers('<!-- toc collapsible=yes -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: {}, problem: 'unknown TOC option collapsible=yes' },
    ]);
  });

  it('parses collapsed and refuses it together with collapsible', () => {
    expect(findMarkers('<!-- toc collapsed="Contents" -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsed: 'Contents' } },
    ]);
    expect(findMarkers('<!-- toc collapsible collapsed -->\n<!-- /toc -->\n')).to.deep.equal([
      {
        start: 0,
        end: 1,
        options: { collapsible: true, collapsed: true },
        problem: 'TOC options collapsible and collapsed exclude each other',
      },
    ]);
  });

  it('parses levels as a level or a range and refuses anything else', () => {
    for (const levels of ['2', '2-3', '-3', '3-', '1-6']) {
      expect(findMarkers(`<!-- toc levels="${levels}" -->\n<!-- /toc -->\n`)).to.deep.equal([{ start: 0, end: 1, options: { levels } }]);
    }
    expect(findMarkers('<!-- toc levels="2" collapsed="Versions" -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { levels: '2', collapsed: 'Versions' } },
    ]);
    for (const [marker, levels] of [
      ['levels', ''],
      ['levels=""', ''],
      ['levels="x"', 'x'],
      ['levels="0"', '0'],
      ['levels="7"', '7'],
      ['levels="3-2"', '3-2'],
      ['levels="2,3"', '2,3'],
      ['levels="-"', '-'],
    ]) {
      expect(findMarkers(`<!-- toc ${marker} -->\n<!-- /toc -->\n`), marker).to.deep.equal([
        { start: 0, end: 1, options: { levels }, warning: `TOC option levels "${levels}" is not a level or a range like 2-3, ignored` },
      ]);
    }
    expect(findMarkers('<!-- toc levels="x" foo -->\n<!-- /toc -->\n')[0]).to.include({
      problem: 'unknown TOC option foo',
      warning: 'TOC option levels "x" is not a level or a range like 2-3, ignored',
    });
  });

  it('collects other well-formed attributes for the summary element, in order', () => {
    expect(findMarkers('<!-- toc collapsed="Jump to" style="font-weight: bold" data-x="1" -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsed: 'Jump to', attributes: { style: 'font-weight: bold', 'data-x': '1' } } },
    ]);
    expect(findMarkers('<!-- toc class="toc" collapsible -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsible: true, attributes: { class: 'toc' } } },
    ]);
  });

  it('refuses attributes without a summary to put them on, and malformed ones', () => {
    expect(findMarkers('<!-- toc style="x" class="y" -->\n<!-- /toc -->\n')).to.deep.equal([
      {
        start: 0,
        end: 1,
        options: { attributes: { style: 'x', class: 'y' } },
        problem: 'TOC attributes style, class need collapsible or collapsed',
      },
    ]);
    expect(findMarkers('<!-- toc collapsed 1x="y" -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsed: true }, problem: 'unknown TOC option 1x="y"' },
    ]);
    expect(findMarkers('<!-- toc collapsed hidden -->\n<!-- /toc -->\n')).to.deep.equal([
      { start: 0, end: 1, options: { collapsed: true }, problem: 'unknown TOC option hidden' },
    ]);
  });

  it('ignores markers in inline code and prose', () => {
    const source = [
      '`<!-- toc -->`',
      'Write `<!-- toc -->` and `<!-- /toc -->` on their own lines.',
      '    <!-- toc -->',
      '- <!-- /toc -->',
      '',
    ].join('\n');
    expect(findMarkers(source)).to.deep.equal([]);
  });

  it('does not treat other comments as markers', () => {
    expect(findMarkers('<!-- tocs -->\n<!-- toc: -->\n<!-- toc --> trailing\n<!-- /toc -->\n')).to.deep.equal([
      { start: -1, end: 3, options: {} },
    ]);
  });
});

describe('levels', () => {
  const changelog = [
    '# Changelog',
    '',
    '<!-- toc levels="2" -->',
    '<!-- /toc -->',
    '',
    '## v2.0.0',
    '',
    '### Breaking',
    '',
    '#### Node',
    '',
    '### Added',
    '',
    '## v1.1.0',
    '',
    '### Added',
    '',
  ].join('\n');

  it('lists only the headings in the level, so a changelog toc has the versions alone', () => {
    const once = buildToc(changelog);
    expect(once).to.equal(
      changelog.replace('<!-- toc levels="2" -->\n', '<!-- toc levels="2" -->\n\n- [v2.0.0](#v200)\n- [v1.1.0](#v110)\n\n'),
    );
    expect(buildToc(once)).to.equal(once);
  });

  it('nests a range from its shallowest level and starts the list flat', () => {
    expect(renderToc(changelog, 3, { levels: '2-3' })).to.equal(
      [
        '<!-- toc levels="2-3" -->',
        '',
        '- [v2.0.0](#v200)',
        '  - [Breaking](#breaking)',
        '  - [Added](#added)',
        '- [v1.1.0](#v110)',
        '  - [Added](#added-1)',
        '',
        '<!-- /toc -->',
      ].join('\n'),
    );
    expect(renderToc(changelog, 3, { levels: '3' })).to.equal(
      ['<!-- toc levels="3" -->', '', '- [Breaking](#breaking)', '- [Added](#added)', '- [Added](#added-1)', '', '<!-- /toc -->'].join(
        '\n',
      ),
    );
  });

  it('takes an open range on either side', () => {
    expect(renderToc(changelog, -1, { levels: '-2' })).to.equal(
      ['<!-- toc levels="-2" -->', '', '- [Changelog](#changelog)', '  - [v2.0.0](#v200)', '  - [v1.1.0](#v110)', '', '<!-- /toc -->'].join(
        '\n',
      ),
    );
    expect(renderToc(changelog, -1, { levels: '3-' })).to.equal(
      [
        '<!-- toc levels="3-" -->',
        '',
        '- [Breaking](#breaking)',
        '  - [Node](#node)',
        '- [Added](#added)',
        '- [Added](#added-1)',
        '',
        '<!-- /toc -->',
      ].join('\n'),
    );
  });

  it('combines with collapsed and leaves a pair alone when no heading is in the range', () => {
    expect(renderToc(changelog, -1, { levels: '2', collapsed: 'Versions' })).to.equal(
      [
        '<!-- toc levels="2" collapsed="Versions" -->',
        '<details>',
        '<summary>Versions</summary>',
        '',
        '- [v2.0.0](#v200)',
        '- [v1.1.0](#v110)',
        '',
        '</details>',
        '<!-- /toc -->',
      ].join('\n'),
    );
    expect(renderToc(changelog, -1, { levels: '5-6' })).to.equal('');
    const source = ['<!-- toc levels="5" -->', 'kept', '<!-- /toc -->', '', '## One', ''].join('\n');
    expect(buildToc(source)).to.equal(source);
  });

  it('ignores a broken value, lists every level and keeps the marker as written', () => {
    const source = ['<!-- toc levels="x" -->', '<!-- /toc -->', '', '## One', '', '### Two', ''].join('\n');
    const once = buildToc(source);
    expect(once).to.equal(
      ['<!-- toc levels="x" -->', '', '- [One](#one)', '  - [Two](#two)', '', '<!-- /toc -->', '', '## One', '', '### Two', ''].join('\n'),
    );
    expect(buildToc(once)).to.equal(once);
    expect(renderToc(source, -1, { levels: '7' })).to.equal(
      ['<!-- toc levels="7" -->', '', '- [One](#one)', '  - [Two](#two)', '', '<!-- /toc -->'].join('\n'),
    );
  });
});

describe('collapsible and collapsed', () => {
  it('collapsible wraps the list in an open details element with a default summary and keeps the marker as written', () => {
    const source = ['# Title', '', '<!-- toc collapsible -->', '<!-- /toc -->', '', '## One', ''].join('\n');
    expect(buildToc(source)).to.equal(
      [
        '# Title',
        '',
        '<!-- toc collapsible -->',
        '<details open>',
        '<summary>Table of contents</summary>',
        '',
        '- [One](#one)',
        '',
        '</details>',
        '<!-- /toc -->',
        '',
        '## One',
        '',
      ].join('\n'),
    );
  });

  it('collapsed wraps the list in a closed details element', () => {
    const source = ['<!-- toc collapsed -->', '<!-- /toc -->', '', '## One', ''].join('\n');
    expect(buildToc(source)).to.equal(
      [
        '<!-- toc collapsed -->',
        '<details>',
        '<summary>Table of contents</summary>',
        '',
        '- [One](#one)',
        '',
        '</details>',
        '<!-- /toc -->',
        '',
        '## One',
        '',
      ].join('\n'),
    );
  });

  it('both take a summary text', () => {
    const collapsible = buildToc(['<!--  toc collapsible="Contents"  -->', '<!-- /toc -->', '', '## One', ''].join('\n'));
    expect(collapsible).to.include(
      '<!--  toc collapsible="Contents"  -->\n<details open>\n<summary>Contents</summary>\n\n- [One](#one)\n\n</details>\n<!-- /toc -->',
    );
    const collapsed = buildToc(['<!-- toc collapsed="Jump to" -->', '<!-- /toc -->', '', '## One', ''].join('\n'));
    expect(collapsed).to.include(
      '<!-- toc collapsed="Jump to" -->\n<details>\n<summary>Jump to</summary>\n\n- [One](#one)\n\n</details>\n<!-- /toc -->',
    );
  });

  it('is idempotent', () => {
    for (const marker of ['<!-- toc collapsible -->', '<!-- toc collapsed="Contents" -->']) {
      const once = buildToc([marker, '<!-- /toc -->', '', '## One', ''].join('\n'));
      expect(buildToc(once)).to.equal(once);
    }
  });

  it('leaves a pair with a problem on the start marker alone', () => {
    for (const marker of ['<!-- toc collapsible foo -->', '<!-- toc collapsible collapsed -->']) {
      const source = [marker, 'kept', '<!-- /toc -->', '', '## One', ''].join('\n');
      expect(buildToc(source)).to.equal(source);
    }
  });

  it('puts the attributes on the summary element as written', () => {
    const source = ['<!-- toc collapsed="Jump to" style="font-weight: bold" class="toc" -->', '<!-- /toc -->', '', '## One', ''].join('\n');
    const once = buildToc(source);
    expect(once).to.equal(
      [
        '<!-- toc collapsed="Jump to" style="font-weight: bold" class="toc" -->',
        '<details>',
        '<summary style="font-weight: bold" class="toc">Jump to</summary>',
        '',
        '- [One](#one)',
        '',
        '</details>',
        '<!-- /toc -->',
        '',
        '## One',
        '',
      ].join('\n'),
    );
    expect(buildToc(once)).to.equal(once);
  });

  it('renderToc formats attributes into the marker after the option', () => {
    expect(renderToc('## One\n', -1, { attributes: { class: 'toc' }, collapsible: true })).to.include(
      '<!-- toc collapsible class="toc" -->\n<details open>\n<summary class="toc">Table of contents</summary>',
    );
  });

  it('renderToc takes the same options', () => {
    expect(renderToc('## One\n', -1, { collapsed: 'Contents' })).to.equal(
      [
        '<!-- toc collapsed="Contents" -->',
        '<details>',
        '<summary>Contents</summary>',
        '',
        '- [One](#one)',
        '',
        '</details>',
        '<!-- /toc -->',
      ].join('\n'),
    );
    expect(renderToc('## One\n', -1, { collapsible: true })).to.include(
      '<!-- toc collapsible -->\n<details open>\n<summary>Table of contents</summary>',
    );
  });
});
