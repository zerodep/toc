import { slugify } from '@0dep/toc';

describe('slugify', () => {
  it('lowercases and turns spaces into hyphens', () => {
    expect(slugify('Getting Started')).to.equal('getting-started');
  });

  it('drops punctuation but keeps hyphens and underscores', () => {
    expect(slugify('What is `foo()`? A/B test_case, ok-then!')).to.equal('what-is-foo-ab-test_case-ok-then');
  });

  it('keeps unicode letters, numbers and marks', () => {
    expect(slugify('Ändra värde 2 gånger')).to.equal('ändra-värde-2-gånger');
  });

  it('does not trim or collapse spaces, github style', () => {
    expect(slugify(' a  b ')).to.equal('-a--b-');
  });
});
