import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { findMarkers } from '@0dep/toc';

const run = promisify(execFile);
const bin = fileURLToPath(new URL('../bin/toc.js', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

describe('bin/toc.js', () => {
  /** @type {string} */
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'toc-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  /** @param {string[]} args */
  function toc(...args) {
    return run(process.execPath, [bin, ...args], { cwd: dir });
  }

  it('defaults to README.md in the current directory and writes the toc', async () => {
    await writeFile(join(dir, 'README.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n## Two\n');
    const { stdout } = await toc();
    expect(stdout).to.equal('README.md: wrote TOC.\n');
    expect(await readFile(join(dir, 'README.md'), 'utf8')).to.include('- [One](#one)\n- [Two](#two)');
  });

  it('reports an up to date toc without rewriting', async () => {
    await writeFile(join(dir, 'README.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n');
    await toc();
    const { stdout } = await toc();
    expect(stdout).to.equal('README.md: TOC already up to date.\n');
  });

  it('writes a file with a byte order mark back with the mark and its first heading listed', async () => {
    await writeFile(join(dir, 'README.md'), '\uFEFF<!-- toc -->\n<!-- /toc -->\n\n# Title\n\n## One\n');
    const { stdout } = await toc();
    expect(stdout).to.equal('README.md: wrote TOC.\n');
    expect(await readFile(join(dir, 'README.md'), 'utf8')).to.equal(
      '\uFEFF<!-- toc -->\n\n- [Title](#title)\n  - [One](#one)\n\n<!-- /toc -->\n\n# Title\n\n## One\n',
    );
  });

  it('takes several files, as arguments or comma separated', async () => {
    await writeFile(join(dir, 'a.md'), '# A\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n');
    await writeFile(join(dir, 'b.md'), '# B\n\n<!-- toc -->\n<!-- /toc -->\n\n## Two\n');
    await writeFile(join(dir, 'c.md'), '# C\n\n<!-- toc -->\n<!-- /toc -->\n\n## Three\n');
    const { stdout } = await toc('a.md,b.md', 'c.md');
    expect(stdout).to.equal('a.md: wrote TOC.\nb.md: wrote TOC.\nc.md: wrote TOC.\n');
  });

  it('exits with 1 and reports a missing file but still processes the rest', async () => {
    await writeFile(join(dir, 'b.md'), '# B\n\n<!-- toc -->\n<!-- /toc -->\n\n## Two\n');
    const err = await toc('missing.md', 'b.md').catch((e) => e);
    expect(err.code).to.equal(1);
    expect(err.stderr).to.match(/^missing\.md: ENOENT/);
    expect(err.stdout).to.equal('b.md: wrote TOC.\n');
  });

  it('--dry-run prints the toc to stdout, the status to stderr, and leaves the file alone', async () => {
    const original = '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n### Two\n';
    await writeFile(join(dir, 'README.md'), original);
    const { stdout, stderr } = await toc('--dry-run');
    expect(stdout).to.equal('<!-- toc -->\n\n- [One](#one)\n  - [Two](#two)\n\n<!-- /toc -->\n');
    expect(stderr).to.equal('README.md: would write TOC.\n');
    expect(await readFile(join(dir, 'README.md'), 'utf8')).to.equal(original);
  });

  it('-n is short for --dry-run and still prints the toc when up to date', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n');
    await toc('a.md');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal('<!-- toc -->\n\n- [One](#one)\n\n<!-- /toc -->\n');
    expect(stderr).to.equal('a.md: TOC already up to date.\n');
  });

  it('warns and skips a file without markers', async () => {
    const original = '# Title\n\n## One\n';
    await writeFile(join(dir, 'a.md'), original);
    const { stdout, stderr } = await toc('a.md');
    expect(stdout).to.equal('');
    expect(stderr).to.equal('a.md: no TOC markers, skipped.\n');
    expect(await readFile(join(dir, 'a.md'), 'utf8')).to.equal(original);
  });

  it('warns with the line number and skips an unbalanced marker', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n\n## One\n');
    await writeFile(join(dir, 'b.md'), '# Title\n\n<!-- /toc -->\n\n## One\n');
    const { stdout, stderr } = await toc('a.md', 'b.md');
    expect(stdout).to.equal('');
    expect(stderr).to.equal(
      'a.md:3: TOC start marker without end marker, skipped.\nb.md:3: TOC end marker without start marker, skipped.\n',
    );
  });

  it('warns with the line number and skips a pair without headings below it', async () => {
    const original = '# Title\n\n<!-- toc -->\n- [stale](#stale)\n<!-- /toc -->\n\ntext\n';
    await writeFile(join(dir, 'a.md'), original);
    const { stdout, stderr } = await toc('a.md');
    expect(stdout).to.equal('');
    expect(stderr).to.equal('a.md:3: no headings below TOC start marker, skipped.\na.md:4: anchor #stale has no target.\n');
    expect(await readFile(join(dir, 'a.md'), 'utf8')).to.equal(original);
  });

  it('updates every pair and warns about the ones it skips', async () => {
    await writeFile(
      join(dir, 'a.md'),
      '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n<!-- toc -->\n<!-- /toc -->\n\n## Two\n\n<!-- toc -->\n',
    );
    const { stdout, stderr } = await toc('a.md');
    expect(stdout).to.equal('a.md: wrote TOC.\n');
    expect(stderr).to.equal('a.md:13: TOC start marker without end marker, skipped.\n');
    const written = await readFile(join(dir, 'a.md'), 'utf8');
    expect(written).to.include('<!-- toc -->\n\n- [One](#one)\n- [Two](#two)\n\n<!-- /toc -->\n\n## One');
    expect(written).to.include('<!-- toc -->\n\n- [Two](#two)\n\n<!-- /toc -->\n\n## Two');
    expect(written).to.match(/## Two\n\n<!-- toc -->\n$/);
  });

  it('--dry-run prints the toc of every heading and warns when there are no markers', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n## One\n');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal('<!-- toc -->\n\n- [Title](#title)\n  - [One](#one)\n\n<!-- /toc -->\n');
    expect(stderr).to.equal('a.md: no TOC markers, skipped.\n');
  });

  it('--dry-run prints the toc below an unbalanced start marker and warns', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n\n## One\n');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal('<!-- toc -->\n\n- [One](#one)\n\n<!-- /toc -->\n');
    expect(stderr).to.equal('a.md:3: TOC start marker without end marker, skipped.\n');
  });

  it('--dry-run prints a plain block for a start marker with a problem and still warns', async () => {
    await writeFile(
      join(dir, 'a.md'),
      '# Title\n\n<!-- toc collapsible foo -->\n<!-- /toc -->\n\n## One\n\n<!-- toc collapsible collapsed -->\n<!-- /toc -->\n\n## Two\n',
    );
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal(
      '<!-- toc -->\n\n- [One](#one)\n- [Two](#two)\n\n<!-- /toc -->\n<!-- toc -->\n\n- [Two](#two)\n\n<!-- /toc -->\n',
    );
    expect(stderr).to.equal(
      'a.md:3: unknown TOC option foo, skipped.\na.md:8: TOC options collapsible and collapsed exclude each other, skipped.\n',
    );
  });

  it('--dry-run prints one block per pair', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n<!-- toc -->\n<!-- /toc -->\n\n## Two\n');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal(
      '<!-- toc -->\n\n- [One](#one)\n- [Two](#two)\n\n<!-- /toc -->\n<!-- toc -->\n\n- [Two](#two)\n\n<!-- /toc -->\n',
    );
    expect(stderr).to.equal('a.md: would write TOC.\n');
  });

  it('warns with the line number and skips a pair with a problem on the start marker', async () => {
    const original =
      '# Title\n\n<!-- toc collapsible foo -->\n<!-- /toc -->\n\n<!-- toc collapsible collapsed -->\n<!-- /toc -->\n\n## One\n';
    await writeFile(join(dir, 'a.md'), original);
    const { stdout, stderr } = await toc('a.md');
    expect(stdout).to.equal('');
    expect(stderr).to.equal(
      'a.md:3: unknown TOC option foo, skipped.\na.md:6: TOC options collapsible and collapsed exclude each other, skipped.\n',
    );
    expect(await readFile(join(dir, 'a.md'), 'utf8')).to.equal(original);
  });

  it('--dry-run prints a collapsible block for a collapsible marker', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc collapsible -->\n<!-- /toc -->\n\n## One\n');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal(
      '<!-- toc collapsible -->\n<details open>\n<summary>Table of contents</summary>\n\n- [One](#one)\n\n</details>\n<!-- /toc -->\n',
    );
    expect(stderr).to.equal('a.md: would write TOC.\n');
  });

  it('--dry-run prints nothing and warns when there are no headings below the markers', async () => {
    await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\ntext\n');
    const { stdout, stderr } = await toc('-n', 'a.md');
    expect(stdout).to.equal('');
    expect(stderr).to.equal('a.md:3: no headings below TOC start marker, skipped.\n');
  });

  describe('anchors', () => {
    it('warns about a link without a target, with the line number, and still exits 0', async () => {
      const original = '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\nSee [two](#two) and [One](#one).\n';
      await writeFile(join(dir, 'a.md'), original);
      const { stdout, stderr } = await toc('a.md');
      expect(stdout).to.equal('a.md: wrote TOC.\n');
      expect(stderr).to.equal('a.md:8: anchor #two has no target.\n');
    });

    it('suggests the target when there is an obvious one', async () => {
      await writeFile(join(dir, 'a.md'), '# Title\n\n## My Heading\n\nSee [x](#My-Heading) and [My Heading](#heading).\n');
      const { stderr } = await toc('a.md');
      expect(stderr).to.equal(
        'a.md: no TOC markers, skipped.\na.md:5: anchor #My-Heading has no target, did you mean #my-heading?\na.md:5: anchor #heading has no target, did you mean #my-heading?\n',
      );
    });

    it('checks the links after the toc is regenerated, so a stale toc is not reported', async () => {
      await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n\n- [Stale](#stale)\n\n<!-- /toc -->\n\n## Fresh\n');
      const { stderr } = await toc('-n', 'a.md');
      expect(stderr).to.equal('a.md: would write TOC.\n');
    });

    it('--check sets exit code 1 when a link has no target', async () => {
      await writeFile(join(dir, 'a.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n[two](#two)\n');
      await writeFile(join(dir, 'b.md'), '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n[one](#one)\n');
      const err = await toc('--check', 'a.md', 'b.md').catch((e) => e);
      expect(err.code).to.equal(1);
      expect(err.stdout).to.equal('a.md: wrote TOC.\nb.md: wrote TOC.\n');
      expect(err.stderr).to.equal('a.md:8: anchor #two has no target.\n');
      const { stdout } = await toc('-c', 'b.md');
      expect(stdout).to.equal('b.md: TOC already up to date.\n');
    });

    it('--check with --dry-run still exits 1 and writes nothing', async () => {
      const original = '# Title\n\n<!-- toc -->\n<!-- /toc -->\n\n## One\n\n[two](#two)\n';
      await writeFile(join(dir, 'a.md'), original);
      const err = await toc('-n', '-c', 'a.md').catch((e) => e);
      expect(err.code).to.equal(1);
      expect(err.stdout).to.equal('<!-- toc -->\n\n- [One](#one)\n\n<!-- /toc -->\n');
      expect(err.stderr).to.equal('a.md: would write TOC.\na.md:8: anchor #two has no target.\n');
      expect(await readFile(join(dir, 'a.md'), 'utf8')).to.equal(original);
    });
  });

  it('--help prints usage and exits 0', async () => {
    for (const flag of ['--help', '-h']) {
      const { stdout } = await toc(flag);
      expect(stdout).to.match(/^Usage: toc \[options\] \[file\.\.\.\]/);
      expect(stdout).to.include('--dry-run');
      expect(stdout).to.include('--help');
    }
  });

  it('rejects unknown options with usage on stderr and exit code 1', async () => {
    const err = await toc('--nope').catch((e) => e);
    expect(err.code).to.equal(1);
    expect(err.stderr).to.match(/^Unknown option: --nope\n\nUsage: toc/);
    expect(err.stdout).to.equal('');
  });

  describe('this README.md', () => {
    it('is up to date and its blocks are exactly what a dry run prints', async () => {
      const { stdout, stderr } = await run(process.execPath, [bin, '--dry-run', 'README.md'], { cwd: repoRoot });
      expect(stderr).to.equal('README.md: TOC already up to date.\n');

      const source = await readFile(join(repoRoot, 'README.md'), 'utf8');
      const lines = source.split('\n');
      const blocks = findMarkers(source).map(({ start, end }) => lines.slice(start, end + 1).join('\n'));
      expect(blocks).to.have.length(3);
      expect(stdout).to.equal(blocks.join('\n') + '\n');
    });

    it('has a plain toc at the top, a collapsed one under API, a collapsible one under Headings, and a deduped anchor', async () => {
      const source = await readFile(join(repoRoot, 'README.md'), 'utf8');
      expect(findMarkers(source).map((m) => m.options)).to.deep.equal([
        {},
        { collapsed: 'Jump to' },
        { collapsible: 'In this section and below' },
      ]);
      expect(source).to.include('<!-- toc -->\n\n- [Install](#install)');
      expect(source).to.include('<details>\n<summary>Jump to</summary>');
      expect(source).to.include('<details open>\n<summary>In this section and below</summary>\n\n- [What is listed](#what-is-listed)');
      expect(source).to.include('- [Options](#options)\n');
      expect(source).to.include('- [Options](#options-1)\n');
    });
  });
});
