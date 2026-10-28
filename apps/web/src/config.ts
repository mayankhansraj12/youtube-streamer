const DEFAULT_API_URL = 'http://localhost:5000';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Base URL of the StreamSync API and Socket.IO server. An empty string means "same origin". */
export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_BACKEND_URL ?? DEFAULT_API_URL);

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

function readIceServers(raw: string | undefined): RTCIceServer[] {
  if (!raw) return DEFAULT_ICE_SERVERS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
  } catch {
    // Handled below with the same fallback as an empty list.
  }

  console.warn('VITE_ICE_SERVERS must be a JSON array of RTCIceServer objects. Using the default STUN servers.');
  return DEFAULT_ICE_SERVERS;
}

/** STUN/TURN servers used for voice connections. Override with VITE_ICE_SERVERS for restrictive networks. */
export const ICE_SERVERS: RTCIceServer[] = readIceServers(import.meta.env.VITE_ICE_SERVERS);

/** Size and length limits, shared with the API so both sides enforce the same values. */
export { LIMITS } from '@streamsync/shared';

export const SYNC = {
  /** Allowed gap between a player and the server timeline before we seek to correct it. */
  driftToleranceSeconds: 1.5,
  /** How often the drift check runs while media is playing. */
  driftCheckIntervalMs: 2000,
  /** How often playback time is refreshed for the progress bar. */
  displayIntervalMs: 250,
  /** Video volume multiplier applied while someone else is speaking, when ducking is enabled. */
  duckedVolume: 0.25,
} as const;

export const APP_NAME = 'StreamSync';
