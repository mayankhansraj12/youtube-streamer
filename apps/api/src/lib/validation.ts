import { ERROR_CODES, LIMITS } from '@streamsync/shared';
import { HttpError } from '../http/http-error.js';

const USERNAME_PATTERN = new RegExp(`^[A-Za-z0-9_.-]{${LIMITS.minUsernameLength},${LIMITS.maxUsernameLength}}$`);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Control characters, except tab (\x09), line feed (\x0A) and carriage return (\x0D).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const validationError = (message: string): HttpError => new HttpError(400, ERROR_CODES.VALIDATION_ERROR, message);

export function normalizeUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw validationError(
      `Username must be ${LIMITS.minUsernameLength}-${LIMITS.maxUsernameLength} characters: letters, numbers, underscores, dots or hyphens`
    );
  }
  return username;
}

/** Email is optional. Blank input becomes `undefined` so the sparse unique index ignores it. */
export function normalizeEmail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw validationError('Enter a valid email address or leave the field blank');
  }
  return email;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < LIMITS.minPasswordLength) {
    throw validationError(`Password must be at least ${LIMITS.minPasswordLength} characters`);
  }
  // bcrypt ignores everything after 72 bytes, so the limit is counted in bytes.
  if (Buffer.byteLength(value, 'utf8') > LIMITS.maxPasswordBytes) {
    throw validationError(`Password must be at most ${LIMITS.maxPasswordBytes} bytes`);
  }
  return value;
}

function stripControlCharacters(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '');
}

export function normalizeRoomName(value: unknown): string {
  if (value === undefined || value === null || value === '') return LIMITS.defaultRoomName;
  if (typeof value !== 'string') throw validationError('Room name must be text');

  const name = stripControlCharacters(value).replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxRoomNameLength);
  return name || LIMITS.defaultRoomName;
}

export function normalizeMessageText(value: unknown, maxLength = LIMITS.maxMessageLength): string {
  if (typeof value !== 'string') throw validationError('Message must be text');

  const text = stripControlCharacters(value.replace(/\r\n?/g, '\n')).trim();
  if (!text) throw validationError('Message cannot be empty');
  if (text.length > maxLength) throw validationError(`Message must be ${maxLength} characters or fewer`);
  return text;
}

export function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw validationError(`${name} must be true or false`);
  return value;
}

export function requirePosition(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > LIMITS.maxPositionSeconds) {
    throw validationError('Position must be a number of seconds');
  }
  return value;
}
