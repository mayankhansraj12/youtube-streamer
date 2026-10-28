'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeUsername,
  normalizeEmail,
  validatePassword,
  normalizeRoomName,
  normalizeMessageText,
  requireBoolean,
  requirePosition,
} = require('../../lib/validation');

test('usernames are trimmed and limited to 3-24 safe characters', () => {
  assert.equal(normalizeUsername('  Mayank_01 '), 'Mayank_01');
  assert.throws(() => normalizeUsername('ab'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => normalizeUsername('has space'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => normalizeUsername('x'.repeat(25)), { code: 'VALIDATION_ERROR' });
  assert.throws(() => normalizeUsername(undefined), { code: 'VALIDATION_ERROR' });
});

test('email is optional, lowercased when present, and validated', () => {
  assert.equal(normalizeEmail(''), undefined);
  assert.equal(normalizeEmail(undefined), undefined);
  assert.equal(normalizeEmail(' Person@Example.COM '), 'person@example.com');
  assert.throws(() => normalizeEmail('not-an-email'), { code: 'VALIDATION_ERROR' });
});

test('passwords need 8+ characters and at most 72 bytes', () => {
  assert.equal(validatePassword('12345678'), '12345678');
  assert.throws(() => validatePassword('1234567'), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validatePassword('é'.repeat(37)), { code: 'VALIDATION_ERROR' });
  assert.throws(() => validatePassword(null), { code: 'VALIDATION_ERROR' });
});

test('room names collapse whitespace, fall back to a default and are capped', () => {
  assert.equal(normalizeRoomName('   Movie   night  '), 'Movie night');
  assert.equal(normalizeRoomName(''), 'Untitled Room');
  assert.equal(normalizeRoomName(undefined), 'Untitled Room');
  assert.equal(normalizeRoomName('x'.repeat(200)).length, 60);
  assert.throws(() => normalizeRoomName({ name: 'x' }), { code: 'VALIDATION_ERROR' });
});

test('chat messages drop control characters and enforce the length limit', () => {
  assert.equal(normalizeMessageText('  hi\u0007 there  '), 'hi there');
  assert.equal(normalizeMessageText('line one\r\nline two'), 'line one\nline two');
  assert.throws(() => normalizeMessageText('   \u0001  '), { code: 'VALIDATION_ERROR' });
  assert.throws(() => normalizeMessageText('x'.repeat(501)), { code: 'VALIDATION_ERROR' });
  assert.equal(normalizeMessageText('x'.repeat(500)).length, 500);
});

test('booleans and playback positions are strictly typed', () => {
  assert.equal(requireBoolean(true, 'muted'), true);
  assert.throws(() => requireBoolean('yes', 'muted'), { code: 'VALIDATION_ERROR' });

  assert.equal(requirePosition(0), 0);
  assert.equal(requirePosition(12.5), 12.5);
  for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, '10', 60 * 60 * 24 * 8]) {
    assert.throws(() => requirePosition(bad), { code: 'VALIDATION_ERROR' }, String(bad));
  }
});
