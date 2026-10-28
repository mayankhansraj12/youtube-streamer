import mongoose from 'mongoose';
import { LIMITS, type ChatMessage, type MediaSource, type PlaybackState, type RoomSummary } from '@streamsync/shared';
import { generateRoomId } from '../../lib/ids.js';
import { Room, type MessageRecord, type PlaybackRecord, type RoomAttributes } from './room.model.js';

const DUPLICATE_KEY_ERROR = 11000;
const MAX_ID_ATTEMPTS = 5;

type RoomSummaryRecord = Pick<RoomAttributes, 'roomId' | 'name' | 'owner' | 'ownerId' | 'createdAt'>;
type RoomSnapshotRecord = Pick<RoomAttributes, 'roomId' | 'name' | 'owner' | 'ownerId' | 'playback'> & {
  messages?: MessageRecord[];
};

export async function createRoom({
  name,
  owner,
  ownerId,
}: {
  name: string;
  owner: string;
  ownerId: string;
}): Promise<RoomSummaryRecord> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await Room.create({ roomId: generateRoomId(), name, owner, ownerId });
    } catch (err) {
      if ((err as { code?: number }).code !== DUPLICATE_KEY_ERROR) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

export async function findRoom(roomId: string): Promise<RoomSummaryRecord | null> {
  return Room.findOne({ roomId }).select('roomId name owner ownerId createdAt').lean<RoomSummaryRecord>();
}

/** Loads everything a client needs to render a room the moment it joins. */
export async function findRoomForSnapshot(roomId: string): Promise<RoomSnapshotRecord | null> {
  return Room.findOne({ roomId })
    .select('roomId name owner ownerId playback')
    .slice('messages', -LIMITS.snapshotMessageCount)
    .lean<RoomSnapshotRecord>();
}

export async function appendMessage(
  roomId: string,
  { userId, username, text }: { userId: string; username: string; text: string }
): Promise<MessageRecord | null> {
  const message: MessageRecord = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(userId),
    username,
    text,
    createdAt: new Date(),
  };
  const result = await Room.updateOne(
    { roomId },
    { $push: { messages: { $each: [message], $slice: -LIMITS.maxStoredMessages } } }
  );
  return result.matchedCount === 1 ? message : null;
}

/**
 * Applies a partial playback update, stamps it with the server clock and resolves to the
 * resulting playback record. With `requireSource`, nothing is changed (resolves to null)
 * when no media is loaded.
 */
export async function updatePlayback(
  roomId: string,
  changes: Partial<Omit<PlaybackRecord, 'updatedAt'>>,
  { requireSource = false }: { requireSource?: boolean } = {}
): Promise<PlaybackRecord | null> {
  const $set: Record<string, unknown> = { 'playback.updatedAt': new Date() };
  for (const [key, value] of Object.entries(changes)) {
    $set[`playback.${key}`] = value;
  }

  const filter = requireSource ? { roomId, 'playback.source': { $ne: null } } : { roomId };
  const room = await Room.findOneAndUpdate(filter, { $set }, {
    returnDocument: 'after',
    projection: { playback: 1 },
    lean: true,
  });
  return room ? room.playback : null;
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const result = await Room.deleteOne({ roomId });
  return result.deletedCount === 1;
}

export function toRoomDTO(room: RoomSummaryRecord): RoomSummary {
  return {
    roomId: room.roomId,
    name: room.name,
    owner: room.owner,
    ownerId: String(room.ownerId),
    createdAt: new Date(room.createdAt).toISOString(),
  };
}

export function toMessageDTO(message: MessageRecord): ChatMessage {
  return {
    id: String(message._id),
    userId: String(message.userId),
    username: message.username,
    text: message.text,
    createdAt: new Date(message.createdAt).getTime(),
  };
}

export function toSourceDTO(source: MediaSource | null | undefined): MediaSource | null {
  if (!source) return null;

  const startAt = source.startAt || 0;
  return source.kind === 'youtube'
    ? { kind: 'youtube', url: source.url, youtubeId: source.youtubeId, startAt }
    : { kind: 'media', url: source.url, mediaType: source.mediaType, format: source.format, startAt };
}

export function toPlaybackDTO(playback: PlaybackRecord | null | undefined): PlaybackState {
  return {
    source: toSourceDTO(playback?.source),
    playing: Boolean(playback?.playing),
    position: playback?.position || 0,
    updatedAt: new Date(playback?.updatedAt || Date.now()).getTime(),
  };
}
