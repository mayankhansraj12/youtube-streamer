import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'),
  quiet: true,
});

export const DEFAULT_CLIENT_ORIGINS: readonly string[] = ['http://localhost:5173', 'http://localhost:8080'];
const MIN_JWT_SECRET_LENGTH = 16;

export interface Config {
  env: string;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  clientOrigins: readonly string[];
  redisUrl: string | null;
  trustProxy: boolean | number;
  maxRoomParticipants: number;
  authRateLimit: number;
}

export type EnvSource = Readonly<Record<string, string | undefined>>;

interface IntegerRange {
  min: number;
  max: number;
}

function parseList(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readInteger(env: EnvSource, name: string, fallback: number, { min, max }: IntegerRange): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function readTrustProxy(env: EnvSource): boolean | number {
  const raw = env.TRUST_PROXY;
  if (raw === undefined || raw === '' || raw === 'false') return false;
  if (raw === 'true') return true;
  return readInteger(env, 'TRUST_PROXY', 0, { min: 0, max: 10 });
}

/**
 * Reads and validates every environment variable the server understands.
 * Throws a descriptive error for anything missing or malformed so that the
 * process fails at boot instead of misbehaving later.
 */
export function loadConfig(env: EnvSource = process.env): Config {
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
