import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';
import { FaCompress, FaExpand, FaPause, FaPlay, FaVolumeUp } from 'react-icons/fa';
import { SYNC } from '../../config';
import { formatClock } from '../../lib/format';
import type { PlayerAdapter, QualityOption } from '../../player/types';

interface PlayerControlsProps {
  adapter: PlayerAdapter | null;
  playing: boolean;
  volume: number;
  quality: string;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onQualityChange: (quality: string) => void;
  onToggleFullscreen: () => void;
}

const iconButton =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

/** Transport bar for the shared player. Seeking commits on release, so the room is not spammed while dragging. */
export default function PlayerControls({
  adapter,
  playing,
  volume,
  quality,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onQualityChange,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [scrubValue, setScrubValue] = useState<number | null>(null);

  useEffect(() => {
    if (!adapter) return undefined;

    const refresh = () => {
      setTime(adapter.getCurrentTime());
      setDuration(adapter.getDuration());
      setQualities(adapter.getQualityOptions());
    };
    const timer = window.setInterval(refresh, SYNC.displayIntervalMs);
    return () => window.clearInterval(timer);
  }, [adapter]);

  const seekable = adapter !== null && duration > 0;
  const shownTime = scrubValue ?? time;
  const progress = seekable ? Math.min(shownTime, duration) / duration : 0;

  const handleScrub = (event: ChangeEvent<HTMLInputElement>) => setScrubValue(Number(event.target.value));
  const commitScrub = () => {
    if (scrubValue === null) return;
    onSeek(scrubValue);
    setScrubValue(null);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-2 pt-12 sm:px-5 sm:pb-3">
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={seekable ? duration : 1}
        step="any"
        value={seekable ? Math.min(shownTime, duration) : 0}
        disabled={!seekable}
        onChange={handleScrub}
        onPointerUp={commitScrub}
        onKeyUp={commitScrub}
        onBlur={commitScrub}
        className="seek-bar mb-2 w-full"
        style={{ '--progress': `${progress * 100}%` } as CSSProperties}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!adapter}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            className={iconButton}
          >
            {playing ? <FaPause size={14} aria-hidden="true" /> : <FaPlay size={14} aria-hidden="true" />}
          </button>
          <span className="truncate font-mono text-xs tabular-nums text-white/80">
            {formatClock(shownTime)} / {formatClock(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <FaVolumeUp className="hidden text-white/70 sm:block" size={14} aria-hidden="true" />
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            className="volume-bar w-16 sm:w-24"
          />
          {qualities.length > 1 && (
            <select
              aria-label="Video quality"
              value={quality}
              onChange={(event) => onQualityChange(event.target.value)}
              className="rounded-md border border-white/10 bg-black/70 px-2 py-1 text-xs text-white focus:outline-none"
            >
              {qualities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
            title="Full screen (F)"
            className={iconButton}
          >
            {isFullscreen ? <FaCompress size={14} aria-hidden="true" /> : <FaExpand size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
