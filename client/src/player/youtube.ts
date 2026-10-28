import type { PlayerAdapter, PlayerHandlers, PlayerState, QualityOption } from './types';

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  getAvailableQualityLevels(): string[];
  getPlaybackQuality(): string;
  setPlaybackQuality(quality: string): void;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const QUALITY_LABELS: Record<string, string> = {
  auto: 'Auto',
  highres: 'Original',
  hd2160: '2160p',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
};

const ERROR_MESSAGES: Record<number, string> = {
  2: 'That YouTube link is not valid.',
  5: 'The YouTube player ran into a problem. Try loading the video again.',
  100: 'This video is private or has been removed.',
  101: 'The video owner does not allow it to be played here.',
  150: 'The video owner does not allow it to be played here.',
};

const PLAYER_STATES: Record<number, PlayerState | undefined> = {
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
};

let youTubeApi: Promise<YouTubeNamespace> | null = null;

/** Loads the IFrame API once per page, no matter how many rooms are opened. */
function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  if (!youTubeApi) {
    youTubeApi = new Promise<YouTubeNamespace>((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (window.YT) resolve(window.YT);
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        script.remove();
        youTubeApi = null;
        reject(new Error('Could not load the YouTube player. Check your connection or ad blocker.'));
      };
      document.head.appendChild(script);
    });
  }
  return youTubeApi;
}

function toQualityOptions(levels: string[]): QualityOption[] {
  const unique = Array.from(new Set(['auto', ...levels]));
  return unique.map((value) => ({ value, label: QUALITY_LABELS[value] ?? value }));
}

export interface YouTubeAdapterOptions {
  youtubeId: string;
  startAt: number;
  initialQuality: string;
  handlers: PlayerHandlers;
}

/** Mounts a YouTube player into `container`. Resolves once the player reports ready. */
export async function createYouTubeAdapter(container: HTMLElement, options: YouTubeAdapterOptions): Promise<PlayerAdapter> {
  const YT = await loadYouTubeApi();
  const { handlers } = options;

  return new Promise<PlayerAdapter>((resolve, reject) => {
    let settled = false;
    let player: YouTubePlayer | null = null;

    const adapter: PlayerAdapter = {
      kind: 'youtube',
      play: () => player?.playVideo(),
      pause: () => player?.pauseVideo(),
      seek: (seconds) => player?.seekTo(seconds, true),
      getCurrentTime: () => player?.getCurrentTime() ?? 0,
      getDuration: () => player?.getDuration() ?? 0,
      setVolume: (volume) => player?.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100)),
      getQualityOptions: () => toQualityOptions(player?.getAvailableQualityLevels() ?? []),
      setQuality: (value) => player?.setPlaybackQuality(value),
      getQuality: () => player?.getPlaybackQuality() ?? null,
      destroy: () => {
        player?.destroy();
        player = null;
      },
    };

    const fail = (message: string) => {
      if (settled) {
        handlers.onError(message);
        return;
      }
      settled = true;
      reject(new Error(message));
    };

    try {
      player = new YT.Player(container, {
        width: '100%',
        height: '100%',
        videoId: options.youtubeId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          start: Math.floor(options.startAt),
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (settled) return;
            settled = true;
            if (options.initialQuality !== 'auto') player?.setPlaybackQuality(options.initialQuality);
            resolve(adapter);
          },
          onStateChange: (event: { data: number }) => {
            const state = PLAYER_STATES[event.data];
            if (state) handlers.onState(state);
          },
          onError: (event: { data: number }) => {
            fail(ERROR_MESSAGES[event.data] ?? 'This video could not be played.');
          },
        },
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'The YouTube player could not start.');
    }
  });
}
