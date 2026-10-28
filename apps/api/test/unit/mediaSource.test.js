'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseMediaSource, parseStartTime } = require('../../src/lib/mediaSource');

const VIDEO_ID = 'dQw4w9WgXcQ';
const CANONICAL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;

test('turns every common YouTube link form into one canonical watch URL', () => {
  const inputs = [
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&list=PL123&index=2`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://music.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?t=42`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/live/${VIDEO_ID}`,
    `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
    VIDEO_ID,
  ];

  for (const input of inputs) {
    const source = parseMediaSource(input);
    assert.equal(source.kind, 'youtube', input);
    assert.equal(source.youtubeId, VIDEO_ID, input);
    assert.equal(source.url, CANONICAL, input);
  }
});

test('reads start offsets from YouTube links', () => {
  assert.equal(parseMediaSource(`https://youtu.be/${VIDEO_ID}?t=1m30s`).startAt, 90);
  assert.equal(parseMediaSource(`https://www.youtube.com/watch?v=${VIDEO_ID}&t=75`).startAt, 75);
  assert.equal(parseMediaSource(`https://www.youtube.com/watch?v=${VIDEO_ID}&start=1:02:03`).startAt, 3723);
  assert.equal(parseMediaSource(VIDEO_ID).startAt, 0);
});

test('rejects YouTube links that do not contain a valid video id', () => {
  const inputs = [
    'https://www.youtube.com/',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    'https://youtu.be/',
  ];
  for (const input of inputs) {
    assert.throws(() => parseMediaSource(input), { code: 'INVALID_SOURCE' }, input);
  }
});

test('classifies direct media links by file extension', () => {
  const pick = ({ kind, mediaType, format }) => ({ kind, mediaType, format });

  assert.deepEqual(pick(parseMediaSource('https://cdn.example.com/clips/intro.mp4')), {
    kind: 'media',
    mediaType: 'video',
    format: 'native',
  });
  assert.deepEqual(pick(parseMediaSource('https://cdn.example.com/live/index.m3u8')), {
    kind: 'media',
    mediaType: 'video',
    format: 'hls',
  });
  assert.deepEqual(pick(parseMediaSource('https://cdn.example.com/song.MP3')), {
    kind: 'media',
    mediaType: 'audio',
    format: 'native',
  });
  assert.deepEqual(pick(parseMediaSource('https://cdn.example.com/stream')), {
    kind: 'media',
    mediaType: 'video',
    format: 'native',
  });
});

test('keeps query strings on direct media links and reads a t= start offset', () => {
  const source = parseMediaSource('https://cdn.example.com/a.mp4?token=abc&t=20');
  assert.equal(source.url, 'https://cdn.example.com/a.mp4?token=abc&t=20');
  assert.equal(source.startAt, 20);
});

test('rejects anything that is not a plain http or https link', () => {
  const inputs = [
    '',
    '   ',
    'not a url',
    'javascript:alert(1)',
    'ftp://example.com/a.mp4',
    'https://user:secret@example.com/a.mp4',
    `https://example.com/${'a'.repeat(2100)}`,
  ];
  for (const input of inputs) {
    assert.throws(() => parseMediaSource(input), { code: 'INVALID_SOURCE' }, input);
  }
  assert.throws(() => parseMediaSource(undefined), { code: 'INVALID_SOURCE' });
  assert.throws(() => parseMediaSource(42), { code: 'INVALID_SOURCE' });
});

test('parses start offsets in each supported notation', () => {
  assert.equal(parseStartTime('90'), 90);
  assert.equal(parseStartTime('90s'), 90);
  assert.equal(parseStartTime('1m30s'), 90);
  assert.equal(parseStartTime('1h2m3s'), 3723);
  assert.equal(parseStartTime('1:30'), 90);
  assert.equal(parseStartTime('1:02:03'), 3723);
  assert.equal(parseStartTime('nonsense'), 0);
  assert.equal(parseStartTime(undefined), 0);
});
