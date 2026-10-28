import type Hls from 'hls.js';
import type { PlayerAdapter, PlayerHandlers } from './types';

export interface MediaAdapterOptions {
  url: string;
  mediaType: 'audio' | 'video';
  format: 'native' | 'hls';
  startAt: number;
  volume: number;
  handlers: PlayerHandlers;
}

const MEDIA_ERROR_MESSAGES: Record<number, string> = {
  1: 'Playback was stopped before the media finished loading.',
  2: 'A network error stopped the media from loading.',
  3: 'The media could not be decoded.',
  4: 'The media could not be loaded. Check that the link is public and points to a supported audio or video file.',
};

function describeMediaError(error: MediaError | null): string {
  return (error && MEDIA_ERROR_MESSAGES[error.code]) || 'The media could not be played.';
}

/**
 * Plays direct audio and video files, and HLS (.m3u8) streams. HLS uses hls.js only when the
 * browser has no native support, and that module is loaded on demand.
 */
export async function createMediaAdapter(container: HTMLElement, options: MediaAdapterOptions): Promise<PlayerAdapter> {
  const { handlers } = options;
  const element = document.createElement(options.mediaType === 'audio' ? 'audio' : 'video');
  element.preload = 'auto';
  element.setAttribute('playsinline', '');
  element.volume = options.volume;
  element.className = options.mediaType === 'audio' ? 'media-player media-player--audio' : 'media-player';
  container.replaceChildren(element);

  let destroyed = false;
  let hlsInstance: Hls | null = null;
  let pendingSeek: number | null = options.startAt > 0 ? options.startAt : null;

  const applyPendingSeek = () => {
    if (pendingSeek !== null && element.readyState >= HTMLMediaElement.HAVE_METADATA) {
      element.currentTime = pendingSeek;
      pendingSeek = null;
    }
  };

  element.addEventListener('loadedmetadata', applyPendingSeek);
  element.addEventListener('playing', () => handlers.onState('playing'));
  element.addEventListener('pause', () => {
    if (!element.ended) handlers.onState('paused');
  });
  element.addEventListener('waiting', () => handlers.onState('buffering'));
  element.addEventListener('ended', () => handlers.onState('ended'));
  element.addEventListener('error', () => handlers.onError(describeMediaError(element.error)));

  const adapter: PlayerAdapter = {
    kind: 'media',
    play: () => {
      const attempt = element.play();
      attempt?.catch((error: DOMException) => {
        if (error.name === 'NotAllowedError') handlers.onPlayBlocked();
        else if (error.name !== 'AbortError') handlers.onError(describeMediaError(element.error));
      });
    },
    pause: () => element.pause(),
    seek: (seconds) => {
      if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
        element.currentTime = seconds;
        pendingSeek = null;
      } else {
        pendingSeek = seconds;
      }
    },
    getCurrentTime: () => (Number.isFinite(element.currentTime) ? element.currentTime : 0),
    getDuration: () => (Number.isFinite(element.duration) ? element.duration : 0),
    setVolume: (volume) => {
      element.volume = Math.min(1, Math.max(0, volume));
    },
    getQualityOptions: () => [],
    setQuality: () => undefined,
    getQuality: () => null,
    destroy: () => {
      destroyed = true;
      hlsInstance?.destroy();
      hlsInstance = null;
      element.pause();
      element.removeAttribute('src');
      element.load();
      container.replaceChildren();
    },
  };

  const needsHlsJs = options.format === 'hls' && !element.canPlayType('application/vnd.apple.mpegurl');
  if (!needsHlsJs) {
    element.src = options.url;
    return adapter;
  }

  const { default: HlsClass } = await import('hls.js');
  if (destroyed) return adapter;
  if (!HlsClass.isSupported()) {
    throw new Error('This browser cannot play HLS streams.');
  }

  const instance = new HlsClass({ enableWorker: true });
  instance.on(HlsClass.Events.ERROR, (_event, data) => {
    if (data.fatal) handlers.onError(`The stream could not be loaded (${data.details}).`);
  });
  instance.loadSource(options.url);
  instance.attachMedia(element);
  hlsInstance = instance;

  return adapter;
}
