import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { SYNC } from '../config';
import { clampToDuration, expectedPosition } from '../lib/playbackClock';
import { createMediaAdapter } from '../player/media';
import type { PlayerAdapter, PlayerState } from '../player/types';
import { createYouTubeAdapter } from '../player/youtube';
import type { MediaSource, PlaybackState } from '../types';
import { useLatest } from './useLatest';

/** Stable identity for a source, so a playback update that keeps the same media never reloads it. */
export function sourceIdentity(source: MediaSource | null): string {
  if (!source) return '';
  return source.kind === 'youtube' ? `youtube:${source.youtubeId}` : `media:${source.url}`;
}

function applyServerState(adapter: PlayerAdapter, playback: PlaybackState, serverNow: number) {
  const target = clampToDuration(expectedPosition(playback, serverNow), adapter.getDuration());
  if (Math.abs(adapter.getCurrentTime() - target) > SYNC.driftToleranceSeconds) {
    adapter.seek(target);
  }
  if (playback.playing) adapter.play();
  else adapter.pause();
}

export interface WatchTogetherOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  playback: PlaybackState | null;
  serverNow: () => number;
  onControl: (playing: boolean, position: number) => void;
  volume: number;
  duckEnabled: boolean;
  duckActive: boolean;
  preferredQuality: string;
}

/**
 * Plays the shared source in this browser and keeps it aligned with the server timeline.
 * Local controls are sent to the server; remote changes arrive as playback state and are applied
 * here, with a drift check while media is playing.
 */
export function useWatchTogether({
  containerRef,
  playback,
  serverNow,
  onControl,
  volume,
  duckEnabled,
  duckActive,
  preferredQuality,
}: WatchTogetherOptions) {
  const source = playback?.source ?? null;
  const key = sourceIdentity(source);

  const [ready, setReady] = useState<{ key: string; adapter: PlayerAdapter } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [blockedKey, setBlockedKey] = useState<string | null>(null);
  const [buffering, setBuffering] = useState(false);
  const latestSource = useLatest(source);
  const latestPlayback = useLatest(playback);
  const latestControl = useLatest(onControl);
  const latestVolume = useLatest(volume);
  const latestQuality = useLatest(preferredQuality);
  const playingRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const current = latestSource.current;
    if (!container || !current) return undefined;

    let cancelled = false;
    let mounted: PlayerAdapter | null = null;
    const handlers = {
      onState: (state: PlayerState) => {
        playingRef.current = state === 'playing';
        setBuffering(state === 'buffering');
        if (state === 'playing') setBlockedKey(null);
        if (state === 'ended' && mounted && latestPlayback.current?.playing) {
          latestControl.current(false, mounted.getDuration());
        }
      },
      onError: (message: string) => setFailure({ key, message }),
      onPlayBlocked: () => setBlockedKey(key),
    };

    const creation =
      current.kind === 'youtube'
        ? createYouTubeAdapter(container, {
            youtubeId: current.youtubeId,
            startAt: current.startAt,
            initialQuality: latestQuality.current,
            handlers,
          })
        : createMediaAdapter(container, {
            url: current.url,
            mediaType: current.mediaType,
            format: current.format,
            startAt: current.startAt,
            volume: latestVolume.current,
            handlers,
          });

    creation
      .then((adapter) => {
        if (cancelled) {
          adapter.destroy();
          return;
        }
        mounted = adapter;
        setBuffering(false);
        setReady({ key, adapter });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure({ key, message: error instanceof Error ? error.message : 'The media could not be loaded.' });
      });

    return () => {
      cancelled = true;
      playingRef.current = false;
      mounted?.destroy();
    };
  }, [key, containerRef, latestSource, latestPlayback, latestControl, latestQuality, latestVolume]);

  const adapter = ready && ready.key === key ? ready.adapter : null;
  const error = failure && failure.key === key ? failure.message : null;
  const blocked = key !== '' && blockedKey === key;
  const loading = key !== '' && adapter === null && error === null;

  useEffect(() => {
    if (adapter && playback) applyServerState(adapter, playback, serverNow());
  }, [adapter, playback, serverNow]);

  useEffect(() => {
    if (!adapter) return undefined;

    const timer = window.setInterval(() => {
      const current = latestPlayback.current;
      if (!current?.playing || !playingRef.current) return;

      const duration = adapter.getDuration();
      const target = clampToDuration(expectedPosition(current, serverNow()), duration);
      if (duration > 0 && target >= duration - 0.5) return;
      if (Math.abs(adapter.getCurrentTime() - target) > SYNC.driftToleranceSeconds) {
        adapter.seek(target);
      }
    }, SYNC.driftCheckIntervalMs);

    return () => window.clearInterval(timer);
  }, [adapter, latestPlayback, serverNow]);

  useEffect(() => {
    if (!adapter) return;
    adapter.setVolume(duckEnabled && duckActive ? volume * SYNC.duckedVolume : volume);
  }, [adapter, volume, duckEnabled, duckActive]);

  useEffect(() => {
    if (adapter?.kind === 'youtube' && preferredQuality !== 'auto') {
      adapter.setQuality(preferredQuality);
    }
  }, [adapter, preferredQuality]);

  const togglePlay = useCallback(() => {
    const current = latestPlayback.current;
    if (!adapter || !current) return;

    const nextPlaying = !current.playing;
    if (nextPlaying) adapter.play();
    else adapter.pause();
    latestControl.current(nextPlaying, adapter.getCurrentTime());
  }, [adapter, latestPlayback, latestControl]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (!adapter) return;
      const target = clampToDuration(seconds, adapter.getDuration());
      adapter.seek(target);
      latestControl.current(latestPlayback.current?.playing ?? false, target);
    },
    [adapter, latestControl, latestPlayback]
  );

  const seekBy = useCallback(
    (delta: number) => {
      if (adapter) seekTo(adapter.getCurrentTime() + delta);
    },
    [adapter, seekTo]
  );

  const resumeBlocked = useCallback(() => {
    adapter?.play();
    setBlockedKey(null);
  }, [adapter]);

  return {
    source,
    adapter,
    loading,
    error,
    blocked,
    buffering,
    togglePlay,
    seekTo,
    seekBy,
    resumeBlocked,
  };
}
