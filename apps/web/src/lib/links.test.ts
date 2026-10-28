import { describe, expect, it } from 'vitest';
import { splitLinks } from './links';

describe('splitLinks', () => {
  it('returns plain text unchanged', () => {
    expect(splitLinks('hello there')).toEqual([{ type: 'text', value: 'hello there' }]);
  });

  it('separates http and https links from the surrounding text', () => {
    expect(splitLinks('watch https://example.com/a now')).toEqual([
      { type: 'text', value: 'watch ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('keeps trailing punctuation out of the link', () => {
    expect(splitLinks('see https://example.com/x.')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com/x', href: 'https://example.com/x' },
      { type: 'text', value: '.' },
    ]);
  });

  it('never turns other URL schemes into links', () => {
    expect(splitLinks('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
  });
});
