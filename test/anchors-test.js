import { findAnchors } from '@0dep/toc';

describe('findAnchors', () => {
  it('returns every link to an anchor with its zero based line, text and whether a target exists', () => {
    const source = ['# Title', '', 'See [Install](#install) and [nope](#missing).', '', '## Install', ''].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 2, text: 'Install', anchor: 'install', valid: true },
      { line: 2, text: 'nope', anchor: 'missing', valid: false },
    ]);
  });

  it('returns an empty array without anchor links', () => {
    expect(findAnchors('# Title\n\n[site](https://example.local)\n')).to.deep.equal([]);
  });

  it('resolves against the numbered slugs of duplicate headings', () => {
    const source = ['# Options', '', '[first](#options) [second](#options-1) [third](#options-2)', '', '## Options', ''].join('\n');
    expect(findAnchors(source).map((a) => a.valid)).to.deep.equal([true, true, false]);
  });

  it('accepts html id and name attributes as targets', () => {
    const source = [
      '<a name="top"></a>',
      '',
      '<h2 id="custom">Custom</h2>',
      '',
      "<div id='single'>",
      '',
      '[t](#top) [c](#custom) [s](#single)',
      '',
    ].join('\n');
    expect(findAnchors(source).map((a) => a.valid)).to.deep.equal([true, true, true]);
  });

  it('ignores links and targets inside fenced code blocks and code spans', () => {
    const source = [
      '# Title',
      '',
      '```md',
      '[x](#fenced)',
      '<a id="fenced-target"></a>',
      '```',
      '',
      'Write `[x](#spanned)` or `id="span-target"` in prose.',
      '',
      '[a](#fenced-target) [b](#span-target)',
      '',
    ].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 9, text: 'a', anchor: 'fenced-target', valid: false },
      { line: 9, text: 'b', anchor: 'span-target', valid: false },
    ]);
  });

  it('leaves links to other documents and to the top of the page alone', () => {
    const source = [
      '## Install',
      '',
      '[a](other.md#install) [b](https://x.y/#install) [c](#) [Install](#) <a href="docs.md#install">d</a> <a href="#">e</a>',
      '',
      '[ref]: other.md#install',
      '',
    ].join('\n');
    expect(findAnchors(source)).to.deep.equal([]);
  });

  it('accepts a percent encoded anchor', () => {
    const source = ['## Åland', '', '[å](#%C3%A5land)', ''].join('\n');
    expect(findAnchors(source)).to.deep.equal([{ line: 2, text: 'å', anchor: '%C3%A5land', valid: true }]);
  });

  it('takes an anchor that is not valid percent encoding as written', () => {
    const source = ['## 100%', '', '[x](#100%) [y](#100)', ''].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 2, text: 'x', anchor: '100%', valid: false, suggestion: '100' },
      { line: 2, text: 'y', anchor: '100', valid: true },
    ]);
  });

  it('suggests the target when slugging the anchor as written lands on one', () => {
    const source = ['## My Heading', '', '[a](#My%20Heading) [b](#My-Heading) [c](#my_heading)', ''].join('\n');
    expect(findAnchors(source).map((a) => a.suggestion)).to.deep.equal(['my-heading', 'my-heading', undefined]);
  });

  it('suggests the target when slugging the link text lands on one', () => {
    const source = ['## Usage `api`', '', '[Usage `api`](#usage) [Usage](#usage)', ''].join('\n');
    expect(findAnchors(source).map((a) => a.suggestion)).to.deep.equal(['usage-api', undefined]);
  });

  it('suggests nothing when the anchor and the text point at different targets', () => {
    const source = ['## Install', '', '## Usage', '', '[Usage](#Install)', ''].join('\n');
    expect(findAnchors(source)[0]).to.deep.equal({ line: 4, text: 'Usage', anchor: 'Install', valid: false });
  });

  it('never suggests for a valid link', () => {
    const source = ['## Install', '', '## Usage', '', '[Usage](#install)', ''].join('\n');
    expect(findAnchors(source)[0]).to.deep.equal({ line: 4, text: 'Usage', anchor: 'install', valid: true });
  });

  it('resolves a backslash escape in the anchor like GitHub does', () => {
    const source = '## foo_bar\n\n[x](#foo\\_bar) [y](#foo\\_baz)\n';
    expect(findAnchors(source)).to.deep.equal([
      { line: 2, text: 'x', anchor: 'foo_bar', valid: true },
      { line: 2, text: 'y', anchor: 'foo_baz', valid: false },
    ]);
  });

  it('ignores links and targets inside indented code blocks', () => {
    const source = ['## A', '', '    [x](#nope)', '    <a id="ind"></a>', '\t[t](#nope)', '', '[y](#ind)', ''].join('\n');
    expect(findAnchors(source)).to.deep.equal([{ line: 6, text: 'y', anchor: 'ind', valid: false }]);
  });

  it('still checks an indented line that continues a paragraph or a list item', () => {
    const source = ['## A', '', 'text', '    [x](#nope)', '', '- item', '    [y](#nope)', ''].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 3, text: 'x', anchor: 'nope', valid: false },
      { line: 6, text: 'y', anchor: 'nope', valid: false },
    ]);
  });

  it('ignores links and targets inside html comments', () => {
    const source = [
      '## A',
      '',
      '<!-- [old](#removed) -->',
      '[x](#nope) <!-- [y](#nope) --> [z](#a)',
      '<!--',
      '[hidden](#removed)',
      '<a id="hidden"></a>',
      '-->',
      '[w](#hidden)',
      '',
    ].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 3, text: 'x', anchor: 'nope', valid: false },
      { line: 3, text: 'z', anchor: 'a', valid: true },
      { line: 8, text: 'w', anchor: 'hidden', valid: false },
    ]);
  });

  it('does not take a comment start inside a code span for a comment', () => {
    const source = '## A\n\n`<!--` [x](#nope)\n[y](#nope)\n';
    expect(findAnchors(source)).to.deep.equal([
      { line: 2, text: 'x', anchor: 'nope', valid: false },
      { line: 3, text: 'y', anchor: 'nope', valid: false },
    ]);
  });

  it('takes an id on any element and a name only on an a element for a target', () => {
    const source = [
      '## Targets',
      '',
      '<div data-id="d"></div> <input name="q"> <a name="legacy"></a> <span id="s"></span>',
      '',
      '[a](#d) [b](#q) [c](#legacy) [e](#s)',
      '',
    ].join('\n');
    expect(findAnchors(source)).to.deep.equal([
      { line: 4, text: 'a', anchor: 'd', valid: false },
      { line: 4, text: 'b', anchor: 'q', valid: false },
      { line: 4, text: 'c', anchor: 'legacy', valid: true },
      { line: 4, text: 'e', anchor: 's', valid: true },
    ]);
  });
});
