import type { RefObject } from 'react';
import { FaPlay, FaVideo } from 'react-icons/fa';
import type { PlayerAdapter } from '../../player/types';
import PlayerControls from './PlayerControls';

interface VideoStageProps {
  stageRef: RefObject<HTMLElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  hasSource: boolean;
  isAudio: boolean;
  adapter: PlayerAdapter | null;
  playing: boolean;
  loading: boolean;
  buffering: boolean;
  blocked: boolean;
  error: string | null;
  volume: number;
  quality: string;
  isFullscreen: boolean;
  onResume: () => void;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onQualityChange: (quality: string) => void;
  onToggleFullscreen: () => void;
}

/** The shared player surface: the media itself, status overlays, and the transport bar. */
export default function VideoStage({
  stageRef,
  containerRef,
  hasSource,
  isAudio,
  adapter,
  playing,
  loading,
  buffering,
  blocked,
  error,
  volume,
  quality,
  isFullscreen,
  onResume,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onQualityChange,
  onToggleFullscreen,
}: VideoStageProps) {
  return (
    <section
      ref={stageRef}
      aria-label="Shared player"
      className="relative h-[42vh] w-full shrink-0 overflow-hidden bg-black lg:h-auto lg:min-h-0 lg:flex-1"
    >
      <div ref={containerRef} className="absolute inset-0" />

      {!hasSource && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="rounded-full bg-white/5 p-5">
            <FaVideo size={26} className="text-white/40" aria-hidden="true" />
          </div>
          <p className="max-w-sm text-sm text-white/60">
            Nothing is playing yet. Paste a YouTube link or a direct media URL above to start watching together.
          </p>
        </div>
      )}

      {hasSource && isAudio && !loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple/30 to-brand-cyan/20">
          <span className="text-sm uppercase tracking-widest text-white/70">Audio playing</span>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <span
            role="status"
            aria-label="Loading media"
            className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-brand-cyan"
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-xl border border-red-500/30 bg-black/85 p-4 text-center text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {blocked && !error && (
        <button
          type="button"
          onClick={onResume}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white"
        >
          <span className="rounded-full bg-white p-5 text-black">
            <FaPlay size={20} aria-hidden="true" />
          </span>
          <span className="text-sm">Autoplay was blocked by your browser. Select to start playback.</span>
        </button>
      )}

      {buffering && !loading && !blocked && (
        <span
          role="status"
          aria-label="Buffering"
          className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-white/10 border-t-white"
        />
      )}

      {adapter && (
        <PlayerControls
          adapter={adapter}
          playing={playing}
          volume={volume}
          quality={quality}
          isFullscreen={isFullscreen}
          onTogglePlay={onTogglePlay}
          onSeek={onSeek}
          onVolumeChange={onVolumeChange}
          onQualityChange={onQualityChange}
          onToggleFullscreen={onToggleFullscreen}
        />
      )}
    </section>
  );
}
