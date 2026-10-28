export type PlayerState = 'playing' | 'paused' | 'buffering' | 'ended';

export interface QualityOption {
  value: string;
  label: string;
}

export interface PlayerHandlers {
  onState: (state: PlayerState) => void;
  onError: (message: string) => void;
  /** The browser refused to start playback without a user gesture. */
  onPlayBlocked: () => void;
}

/**
 * One interface for every source the room can play. Implementations are local to this
 * browser; synchronisation with other participants happens in the room hooks.
 */
export interface PlayerAdapter {
  readonly kind: 'youtube' | 'media';
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  /** Volume from 0 to 1. */
  setVolume(volume: number): void;
  getQualityOptions(): QualityOption[];
  setQuality(value: string): void;
  getQuality(): string | null;
  destroy(): void;
}
