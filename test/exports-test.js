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

  it('can be required, there is no commonjs bundle', () => {
    const cjs = createRequire(import.meta.url)('@0dep/toc');
    expect(Object.keys(cjs).sort()).to.deep.equal(Object.keys(toc).sort());
    expect(cjs.buildToc).to.equal(toc.buildToc);
  });

  it('has no node imports so it runs in a browser', async () => {
    const source = await readFile(new URL('../index.js', import.meta.url), 'utf8');
    expect(source).to.not.match(/\b(?:import|require)\b.*['"]node:/);
  });
});
