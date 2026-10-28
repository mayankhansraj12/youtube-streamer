import { describe, expect, it } from 'vitest';
import {
  DECK_STORAGE_KEY,
  DEFAULT_DECK_SETTINGS,
  readDeckSettings,
  sanitizeDeckSettings,
  writeDeckSettings,
} from './deckSettings';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  const storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key);
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
  return storage as unknown as Storage;
}

describe('sanitizeDeckSettings', () => {
  it('returns defaults for anything that is not an object', () => {
    expect(sanitizeDeckSettings(null)).toEqual(DEFAULT_DECK_SETTINGS);
    expect(sanitizeDeckSettings('nonsense')).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it('keeps valid values and replaces invalid ones with defaults', () => {
    const settings = sanitizeDeckSettings({
      inputDeviceId: 'mic-1',
      echoCancellation: false,
      voiceMode: 'shout',
      videoVolume: 7,
    });

    expect(settings.inputDeviceId).toBe('mic-1');
    expect(settings.echoCancellation).toBe(false);
    expect(settings.voiceMode).toBe('open');
    expect(settings.videoVolume).toBe(1);
    expect(settings.noiseSuppression).toBe(DEFAULT_DECK_SETTINGS.noiseSuppression);
  });

  it('clamps the shared video volume between 0 and 1', () => {
    expect(sanitizeDeckSettings({ videoVolume: -2 }).videoVolume).toBe(0);
    expect(sanitizeDeckSettings({ videoVolume: 0.4 }).videoVolume).toBe(0.4);
  });
});

describe('deck settings storage', () => {
  it('returns defaults when nothing is stored or the stored JSON is broken', () => {
    expect(readDeckSettings(memoryStorage())).toEqual(DEFAULT_DECK_SETTINGS);
    expect(readDeckSettings(memoryStorage({ [DECK_STORAGE_KEY]: '{not json' }))).toEqual(DEFAULT_DECK_SETTINGS);
  });

  it('round-trips a saved configuration', () => {
    const storage = memoryStorage();
    const changed = { ...DEFAULT_DECK_SETTINGS, voiceMode: 'push-to-talk' as const, preferredQuality: 'hd720' };

    writeDeckSettings(changed, storage);
    expect(readDeckSettings(storage)).toEqual(changed);
  });
});
