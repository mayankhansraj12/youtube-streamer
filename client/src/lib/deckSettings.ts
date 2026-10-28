export type VoiceMode = 'open' | 'push-to-talk';

/** Per-browser preferences for the audio deck and video quality. Stored in localStorage. */
export interface DeckSettings {
  /** Empty string means the system default device. */
  inputDeviceId: string;
  outputDeviceId: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  voiceMode: VoiceMode;
  duckVideoWhenSpeaking: boolean;
  /** Local volume for the shared video or audio, from 0 to 1. */
  videoVolume: number;
  /** "auto" or a YouTube quality label such as "hd720". */
  preferredQuality: string;
}

export const DEFAULT_DECK_SETTINGS: DeckSettings = {
  inputDeviceId: '',
  outputDeviceId: '',
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceMode: 'open',
  duckVideoWhenSpeaking: true,
  videoVolume: 1,
  preferredQuality: 'auto',
};

export const DECK_STORAGE_KEY = 'streamsync.audioDeck';

const pickString = (value: unknown, fallback: string) => (typeof value === 'string' ? value : fallback);
const pickBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Accepts any value found in storage and returns a complete, valid settings object. */
export function sanitizeDeckSettings(input: unknown): DeckSettings {
  const raw: Record<string, unknown> = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const volume = typeof raw.videoVolume === 'number' && Number.isFinite(raw.videoVolume) ? raw.videoVolume : 1;

  return {
    inputDeviceId: pickString(raw.inputDeviceId, DEFAULT_DECK_SETTINGS.inputDeviceId),
    outputDeviceId: pickString(raw.outputDeviceId, DEFAULT_DECK_SETTINGS.outputDeviceId),
    echoCancellation: pickBoolean(raw.echoCancellation, DEFAULT_DECK_SETTINGS.echoCancellation),
    noiseSuppression: pickBoolean(raw.noiseSuppression, DEFAULT_DECK_SETTINGS.noiseSuppression),
    autoGainControl: pickBoolean(raw.autoGainControl, DEFAULT_DECK_SETTINGS.autoGainControl),
    voiceMode: raw.voiceMode === 'push-to-talk' ? 'push-to-talk' : 'open',
    duckVideoWhenSpeaking: pickBoolean(raw.duckVideoWhenSpeaking, DEFAULT_DECK_SETTINGS.duckVideoWhenSpeaking),
    videoVolume: Math.min(1, Math.max(0, volume)),
    preferredQuality: pickString(raw.preferredQuality, DEFAULT_DECK_SETTINGS.preferredQuality),
  };
}

export function readDeckSettings(storage: Storage | null = getLocalStorage()): DeckSettings {
  try {
    const stored = storage?.getItem(DECK_STORAGE_KEY);
    return stored ? sanitizeDeckSettings(JSON.parse(stored)) : DEFAULT_DECK_SETTINGS;
  } catch {
    return DEFAULT_DECK_SETTINGS;
  }
}

export function writeDeckSettings(settings: DeckSettings, storage: Storage | null = getLocalStorage()): void {
  try {
    storage?.setItem(DECK_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be full or blocked. The settings still apply for this session.
  }
}

function getLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
