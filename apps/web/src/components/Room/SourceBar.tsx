import { useState, type FormEvent } from 'react';
import { FaPlay } from 'react-icons/fa';
import { LIMITS } from '../../config';
import { getErrorMessage } from '../../lib/api';

interface SourceBarProps {
  onLoad: (url: string) => Promise<void>;
}

/** Loads a YouTube link or a direct media URL for everyone in the room. The server validates the link. */
export default function SourceBar({ onLoad }: SourceBarProps) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = value.trim();
    if (!url || busy) return;

    if (url.length > LIMITS.maxUrlLength) {
      setError(`Links can be at most ${LIMITS.maxUrlLength} characters long.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onLoad(url);
      setValue('');
    } catch (caught) {
      setError(getErrorMessage(caught, 'That link could not be loaded.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-b border-white/5 bg-brand-surface/40 px-4 py-3 lg:px-6" aria-label="Load media">
      <div className="flex gap-2">
        <label htmlFor="media-url" className="sr-only">
          YouTube link or direct media URL
        </label>
        <input
          id="media-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste a YouTube link or a direct media URL"
          aria-invalid={error !== null}
          aria-describedby={error ? 'media-url-error' : undefined}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-brand-black/60 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-brand-cyan/50 focus:outline-none focus:ring-1 focus:ring-brand-cyan/50"
        />
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FaPlay size={11} aria-hidden="true" />
          {busy ? 'Loading' : 'Load'}
        </button>
      </div>
      {error && (
        <p id="media-url-error" role="alert" className="mt-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
