import { describe, expect, it } from 'vitest';
import { formatClock, initialOf } from './format';

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
  });

  it('adds hours for media longer than an hour', () => {
    expect(formatClock(3723)).toBe('1:02:03');
  });

  it('treats invalid and negative values as zero', () => {
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('initialOf', () => {
  it('uses the first visible character in upper case', () => {
    expect(initialOf('  ana')).toBe('A');
  });

  it('falls back to a question mark for blank names', () => {
    expect(initialOf('   ')).toBe('?');
  });
});
