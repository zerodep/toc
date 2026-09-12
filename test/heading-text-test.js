import { headingText } from '@0dep/toc';

describe('headingText', () => {
  it('returns plain text unchanged', () => {
    expect(headingText('Plain heading')).to.equal('Plain heading');
  });

  it('strips optional closing hashes', () => {
    expect(headingText('Heading ##')).to.equal('Heading');
    expect(headingText('Heading#')).to.equal('Heading#');
  });

  it('reduces links and images to their text', () => {
    expect(headingText('See [the docs](https://example.com) and ![alt](img.png)')).to.equal('See the docs and alt');
    expect(headingText('Reference [style][ref]')).to.equal('Reference style');
  });

  it('unwraps autolinks and removes html tags', () => {
    expect(headingText('Visit <https://example.com> <b>now</b>')).to.equal('Visit https://example.com now');
  });

  it('removes emphasis and strikethrough markers', () => {
    expect(headingText('**bold** and *em* and ~~gone~~')).to.equal('bold and em and gone');
    expect(headingText('__bold__ and _em_')).to.equal('bold and em');
  });

  it('keeps underscores inside words', () => {
    expect(headingText('snake_case_name')).to.equal('snake_case_name');
  });

  it('keeps code span content but drops the backticks', () => {
    expect(headingText('Call `foo(*bar*)` now')).to.equal('Call foo(*bar*) now');
    expect(headingText('Use `` a`b `` here')).to.equal('Use a`b here');
    expect(headingText('Keep `  ` spaces')).to.equal('Keep    spaces');
    expect(headingText('One ` x` side')).to.equal('One  x side');
  });

  it('resolves backslash escapes', () => {
    expect(headingText('Not \\*emphasis\\*')).to.equal('Not *emphasis*');
  });
});
