import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomId, normalizeRoomId } from '../../src/lib/ids.js';
import { createRateLimiter } from '../../src/lib/rate-limiter.js';
import { signSession, verifySession } from '../../src/lib/session-token.js';
import { isOriginAllowed } from '../../src/lib/origins.js';
import { loadConfig } from '../../src/config.js';

const SECRET = 'unit-test-secret-0123456789';

test('generated room ids are 8 unambiguous lowercase characters', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const id = generateRoomId();
    assert.match(id, /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
    ids.add(id);
  }
  assert.equal(ids.size, 500, 'ids should not repeat in a small sample');
});

test('room ids are normalised to lowercase and rejected when malformed', () => {
  assert.equal(normalizeRoomId('  AbC123 '), 'abc123');
  assert.equal(normalizeRoomId('ab'), null);
  assert.equal(normalizeRoomId('room name'), null);
  assert.equal(normalizeRoomId('../etc'), null);
  assert.equal(normalizeRoomId(42), null);
});

test('token bucket allows bursts, then refills over time', () => {
  let clock = 0;
  const limiter = createRateLimiter({ capacity: 2, refillPerSecond: 1, now: () => clock });

  assert.equal(limiter.take(), true);
  assert.equal(limiter.take(), true);
  assert.equal(limiter.take(), false);

  clock += 1000;
  assert.equal(limiter.take(), true);
  assert.equal(limiter.take(), false);

  clock += 60_000;
  assert.equal(limiter.take(), true);
  assert.equal(limiter.take(), true);
  assert.equal(limiter.take(), false, 'refill never exceeds capacity');
});

test('session tokens round-trip and are rejected when tampered or expired', () => {
  const token = signSession({ id: '507f1f77bcf86cd799439011', username: 'mayank' }, { secret: SECRET, expiresIn: '1h' });
  assert.deepEqual(verifySession(token, SECRET), { id: '507f1f77bcf86cd799439011', username: 'mayank' });

  assert.equal(verifySession(token, 'a-different-secret-entirely'), null);
  assert.equal(verifySession(`${token}x`, SECRET), null);
  assert.equal(verifySession(undefined, SECRET), null);

  const expired = signSession({ id: '507f1f77bcf86cd799439011', username: 'mayank' }, { secret: SECRET, expiresIn: -10 });
  assert.equal(verifySession(expired, SECRET), null);
});

test('origin checks allow listed browser origins and non-browser clients only', () => {
  const allowed = ['https://app.example.com'];
  assert.equal(isOriginAllowed('https://app.example.com', allowed), true);
  assert.equal(isOriginAllowed('https://evil.example.net', allowed), false);
  assert.equal(isOriginAllowed(undefined, allowed), true);
});

test('config reads defaults and fails fast on missing or weak settings', () => {
  const base = { MONGODB_URI: 'mongodb://localhost:27017/test', JWT_SECRET: SECRET };
  const config = loadConfig(base);
  assert.equal(config.port, 5000);
  assert.equal(config.jwtExpiresIn, '7d');
  assert.deepEqual(config.clientOrigins, ['http://localhost:5173', 'http://localhost:8080']);
  assert.equal(config.maxRoomParticipants, 12);

  assert.throws(() => loadConfig({ JWT_SECRET: SECRET }), /MONGODB_URI is required/);
  assert.throws(() => loadConfig({ ...base, JWT_SECRET: 'short' }), /JWT_SECRET is required/);
  assert.throws(() => loadConfig({ ...base, PORT: '99999' }), /PORT must be an integer/);
  assert.throws(() => loadConfig({ ...base, MAX_ROOM_PARTICIPANTS: '1' }), /MAX_ROOM_PARTICIPANTS/);
  assert.deepEqual(loadConfig({ ...base, CLIENT_ORIGIN: ' https://a.test , https://b.test ' }).clientOrigins, [
    'https://a.test',
    'https://b.test',
  ]);
});
