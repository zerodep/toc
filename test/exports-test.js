import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

import * as toc from '@0dep/toc';

describe('package', () => {
  it('exports the api, and nothing that touches the filesystem', () => {
    expect(Object.keys(toc).sort()).to.deep.equal([
      'TOC_END',
      'TOC_START',
      'buildToc',
      'findAnchors',
      'findMarkers',
      'headingText',
      'renderToc',
      'slugify',
    ]);
  });

  it('exports the same from the commonjs bundle', () => {
    const cjs = createRequire(import.meta.url)('../index.cjs');
    expect(Object.keys(cjs).sort()).to.deep.equal(Object.keys(toc).sort());
    expect(cjs.buildToc('<!-- toc -->\n<!-- /toc -->\n# A\n')).to.equal(toc.buildToc('<!-- toc -->\n<!-- /toc -->\n# A\n'));
  });

  it('has no node imports so it runs in a browser', async () => {
    for (const file of ['index.js', 'index.cjs']) {
      const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(source, file).to.not.match(/\b(?:import|require)\b.*['"]node:/);
    }
  });
});
