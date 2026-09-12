import { TOC_START, TOC_END } from '@0dep/toc';

describe('markers', () => {
  it('exports the toc start and end markers', () => {
    expect(TOC_START).to.equal('<!-- toc -->');
    expect(TOC_END).to.equal('<!-- /toc -->');
  });
});
