import { describe, expect, it } from 'vitest';
import { clampToDuration, estimateClockOffset, expectedPosition } from './playbackClock';

describe('expectedPosition', () => {
  it('returns the stored position while paused', () => {
    expect(expectedPosition({ playing: false, position: 42, updatedAt: 1_000 }, 60_000)).toBe(42);
  });

  it('projects forward by the elapsed server time while playing', () => {
    expect(expectedPosition({ playing: true, position: 10, updatedAt: 1_000 }, 4_000)).toBeCloseTo(13);
  });

  it('never returns a negative position when the local clock is behind', () => {
    expect(expectedPosition({ playing: true, position: 0, updatedAt: 5_000 }, 1_000)).toBe(0);
  });
});

describe('estimateClockOffset', () => {
  it('assumes the server stamped its reply halfway through the round trip', () => {
    expect(estimateClockOffset(5_100, 1_000, 1_200)).toBe(4_000);
  });
});

describe('clampToDuration', () => {
  it('keeps positions inside the media once the duration is known', () => {
    expect(clampToDuration(130, 120)).toBe(120);
    expect(clampToDuration(-4, 120)).toBe(0);
  });

  it('only floors at zero while the duration is still unknown', () => {
    expect(clampToDuration(130, 0)).toBe(130);
    expect(clampToDuration(-1, Number.NaN)).toBe(0);
  });
});
