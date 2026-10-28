'use strict';

const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const DEFAULT_CLIENT_ORIGINS = ['http://localhost:5173', 'http://localhost:8080'];
const MIN_JWT_SECRET_LENGTH = 16;

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readInteger(env, name, fallback, { min, max }) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function readTrustProxy(env) {
  const raw = env.TRUST_PROXY;
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  return readInteger(env, 'TRUST_PROXY', false, { min: 0, max: 10 });
}

/**
 * Reads and validates every environment variable the server understands.
 * Throws a descriptive error for anything missing or malformed so that the
 * process fails at boot instead of misbehaving later.
 */
function loadConfig(env = process.env) {
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required (for example mongodb://localhost:27017/streamsync)');
  }

  const jwtSecret = env.JWT_SECRET || '';
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET is required and must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }

  const clientOrigins = parseList(env.CLIENT_ORIGIN);

  return {
    env: env.NODE_ENV || 'development',
    port: readInteger(env, 'PORT', 5000, { min: 1, max: 65535 }),
    mongoUri,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    clientOrigins: clientOrigins.length > 0 ? clientOrigins : DEFAULT_CLIENT_ORIGINS,
    redisUrl: env.REDIS_URL || null,
    trustProxy: readTrustProxy(env),
    maxRoomParticipants: readInteger(env, 'MAX_ROOM_PARTICIPANTS', 12, { min: 2, max: 50 }),
    authRateLimit: readInteger(env, 'AUTH_RATE_LIMIT', 30, { min: 1, max: 10000 }),
  };
}

module.exports = { loadConfig, DEFAULT_CLIENT_ORIGINS };
