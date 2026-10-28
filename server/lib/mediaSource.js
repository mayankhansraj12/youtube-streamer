'use strict';

const { HttpError } = require('./httpError');
const { MAX_URL_LENGTH } = require('./limits');

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTU_BE_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PATH_PATTERN = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/;

const AUDIO_EXTENSIONS = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'oga', 'ogg', 'opus']);
const HLS_EXTENSIONS = new Set(['m3u8']);

const invalidSource = (message) => new HttpError(400, 'INVALID_SOURCE', message);

/**
 * Parses a start offset into seconds. Accepts "90", "90s", "1m30s", "1h2m3s",
 * "1:30" and "1:02:03". Anything unrecognised starts at zero.
 */
function parseStartTime(raw) {
  if (!raw) return 0;
  const value = String(raw).trim().toLowerCase();

  if (/^\d+$/.test(value)) return Number(value);

  const clock = value.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})$/);
  if (clock) {
    const [, hours = '0', minutes, seconds] = clock;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  const units = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (units && value.length > 0) {
    const [, hours = '0', minutes = '0', seconds = '0'] = units;
    return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  return 0;
}

function isYouTubeUrl(url) {
  const host = url.hostname.toLowerCase();
  return YOUTUBE_HOSTS.has(host) || YOUTU_BE_HOSTS.has(host);
}

function extractYouTubeId(url) {
  if (YOUTU_BE_HOSTS.has(url.hostname.toLowerCase())) {
    return url.pathname.slice(1).split('/')[0] || null;
  }
  if (url.pathname === '/watch') {
    return url.searchParams.get('v');
  }
  const match = url.pathname.match(YOUTUBE_PATH_PATTERN);
  return match ? match[1] : null;
}

function getExtension(pathname) {
  const fileName = pathname.split('/').pop() || '';
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

function youtubeSource(youtubeId, startAt) {
  return {
    kind: 'youtube',
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    youtubeId,
    startAt,
  };
}

function mediaSource(url) {
  const extension = getExtension(url.pathname);
  return {
    kind: 'media',
    url: url.href,
    mediaType: AUDIO_EXTENSIONS.has(extension) ? 'audio' : 'video',
    format: HLS_EXTENSIONS.has(extension) ? 'hls' : 'native',
    startAt: parseStartTime(url.searchParams.get('t')),
  };
}

/**
 * Turns user input into a canonical playback source. YouTube links become
 * `{ kind: 'youtube', youtubeId, url, startAt }`; any other http(s) link becomes
 * `{ kind: 'media', url, mediaType, format, startAt }`. Throws an HttpError otherwise.
 */
function parseMediaSource(input) {
  if (typeof input !== 'string') throw invalidSource('Paste a YouTube link or a direct media URL');

  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) {
    throw invalidSource(`Paste a link of up to ${MAX_URL_LENGTH} characters`);
  }

  if (YOUTUBE_ID_PATTERN.test(raw)) return youtubeSource(raw, 0);

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw invalidSource('That does not look like a valid link');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw invalidSource('Only http and https links are supported');
  }
  if (url.username || url.password) {
    throw invalidSource('Links with embedded credentials are not supported');
  }

  if (isYouTubeUrl(url)) {
    const youtubeId = extractYouTubeId(url);
    if (!youtubeId || !YOUTUBE_ID_PATTERN.test(youtubeId)) {
      throw invalidSource('Could not find a valid YouTube video ID in that link');
    }
    return youtubeSource(youtubeId, parseStartTime(url.searchParams.get('t') || url.searchParams.get('start')));
  }

  return mediaSource(url);
}

module.exports = { parseMediaSource, parseStartTime };
