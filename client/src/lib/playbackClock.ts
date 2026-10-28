import type { PlaybackState } from '../types';

/** Where playback should be on the server timeline at `serverNow` (server epoch milliseconds). */
export function expectedPosition(
  state: Pick<PlaybackState, 'playing' | 'position' | 'updatedAt'>,
  serverNow: number
): number {
  if (!state.playing) return state.position;
  return Math.max(0, state.position + (serverNow - state.updatedAt) / 1000);
}

/**
 * Turns one request/response round trip into a clock offset, so that
 * `serverNow = Date.now() + offset`. Assumes the server stamped its reply halfway through.
 */
export function estimateClockOffset(serverTime: number, requestSentAt: number, replyReceivedAt: number): number {
  const midpoint = requestSentAt + (replyReceivedAt - requestSentAt) / 2;
  return serverTime - midpoint;
}

/** Keeps a position inside [0, duration] once the duration is known. */
export function clampToDuration(seconds: number, duration: number): number {
  const floored = Math.max(0, seconds);
  if (!Number.isFinite(duration) || duration <= 0) return floored;
  return Math.min(floored, duration);
}
