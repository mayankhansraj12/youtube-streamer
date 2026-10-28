import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_DECK_SETTINGS, readDeckSettings, writeDeckSettings, type DeckSettings } from '../lib/deckSettings';

/** Audio deck and playback preferences, saved in this browser. */
export function useDeckSettings() {
  const [settings, setSettings] = useState<DeckSettings>(() => readDeckSettings());

  useEffect(() => {
    writeDeckSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<DeckSettings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_DECK_SETTINGS), []);

  return { settings, update, reset };
}
