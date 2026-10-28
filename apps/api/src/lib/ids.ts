import crypto from 'node:crypto';
import { LIMITS } from '@streamsync/shared';

// Lowercase letters and digits, without look-alike characters (0, o, 1, l, i).
const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const ROOM_ID_PATTERN = /^[a-z0-9]{4,32}$/;

export function generateRoomId(length = LIMITS.roomIdLength): string {
  let id = '';
  for (let i = 0; i < length; i += 1) {
    id += ROOM_ID_ALPHABET[crypto.randomInt(ROOM_ID_ALPHABET.length)];
  }
  return id;
}

/** Returns the canonical room id, or `null` when the input cannot be a room id. */
export function normalizeRoomId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const roomId = value.trim().toLowerCase();
  return ROOM_ID_PATTERN.test(roomId) ? roomId : null;
}
