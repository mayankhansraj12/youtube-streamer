'use strict';

const { HttpError } = require('./httpError');
const {
  DEFAULT_ROOM_NAME,
  MAX_ROOM_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_POSITION_SECONDS,
} = require('./limits');

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes.

// Control characters, except tab (\x09), line feed (\x0A) and carriage return (\x0D).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const validationError = (message) => new HttpError(400, 'VALIDATION_ERROR', message);

function normalizeUsername(value) {
  const username = typeof value === 'string' ? value.trim() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw validationError('Username must be 3-24 characters: letters, numbers, underscores, dots or hyphens');
  }
  return username;
}

/** Email is optional. Blank input becomes `undefined` so the sparse unique index ignores it. */
function normalizeEmail(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw validationError('Enter a valid email address or leave the field blank');
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw validationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    throw validationError(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  return value;
}

function stripControlCharacters(value) {
  return value.replace(CONTROL_CHARACTERS, '');
}

function normalizeRoomName(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_ROOM_NAME;
  if (typeof value !== 'string') throw validationError('Room name must be text');

  const name = stripControlCharacters(value).replace(/\s+/g, ' ').trim().slice(0, MAX_ROOM_NAME_LENGTH);
  return name || DEFAULT_ROOM_NAME;
}

function normalizeMessageText(value, maxLength = MAX_MESSAGE_LENGTH) {
  if (typeof value !== 'string') throw validationError('Message must be text');

  const text = stripControlCharacters(value.replace(/\r\n?/g, '\n')).trim();
  if (!text) throw validationError('Message cannot be empty');
  if (text.length > maxLength) throw validationError(`Message must be ${maxLength} characters or fewer`);
  return text;
}

function requireBoolean(value, name) {
  if (typeof value !== 'boolean') throw validationError(`${name} must be true or false`);
  return value;
}

function requirePosition(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_POSITION_SECONDS) {
    throw validationError('Position must be a number of seconds');
  }
  return value;
}

module.exports = {
  normalizeUsername,
  normalizeEmail,
  validatePassword,
  normalizeRoomName,
  normalizeMessageText,
  requireBoolean,
  requirePosition,
};
