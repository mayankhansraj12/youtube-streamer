import {
  ERROR_CODES,
  LIMITS,
  type Ack,
  type AckReply,
  type ClientToServerEvents,
  type ErrorCode,
  type IceCandidatePayload,
  type Participant,
  type SessionDescriptionPayload,
  type SignalRequest,
} from '@streamsync/shared';
import type { Config } from '../config.js';
import { HttpError } from '../http/http-error.js';
import { normalizeRoomId } from '../lib/ids.js';
import { createRateLimiter } from '../lib/rate-limiter.js';
import { normalizeMessageText, requireBoolean, requirePosition } from '../lib/validation.js';
import { parseMediaSource } from '../modules/media/media-source.js';
import {
  appendMessage,
  findRoom,
  findRoomForSnapshot,
  toMessageDTO,
  toPlaybackDTO,
  updatePlayback,
} from '../modules/rooms/room.service.js';
import type { RoomServer, RoomSocket, SocketData } from './types.js';

const SDP_TYPES: ReadonlySet<string> = new Set(['offer', 'answer', 'pranswer', 'rollback']);

type ClientEvent = keyof ClientToServerEvents;
type ClientEventArgs<E extends ClientEvent> = Parameters<ClientToServerEvents[E]>;

function reply<T extends object = Record<string, never>>(ack: Ack<T> | undefined, payload?: T): void {
  if (typeof ack === 'function') ack({ ok: true, ...payload } as AckReply<T>);
}

function fail(ack: unknown, code: ErrorCode, message: string): void {
  if (typeof ack === 'function') ack({ ok: false, code, message });
}

function toParticipant(socketId: string, data: SocketData): Participant {
  return {
    socketId,
    userId: data.user.id,
    username: data.user.username,
    muted: Boolean(data.muted),
    joinedAt: data.joinedAt ?? 0,
  };
}

/** Presence is derived from live sockets, so it stays correct across restarts and multiple nodes. */
export async function listParticipants(
  io: RoomServer,
  roomId: string,
  excludeId: string | null = null
): Promise<Participant[]> {
  const sockets = await io.in(roomId).fetchSockets();
  return sockets
    .filter((remote) => remote.id !== excludeId && remote.data.roomId === roomId)
    .map((remote) => toParticipant(remote.id, remote.data))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

async function leaveRoom(io: RoomServer, socket: RoomSocket): Promise<void> {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const wasMember = socket.rooms.has(roomId);
  const participant = toParticipant(socket.id, socket.data);
  socket.data.roomId = null;
  if (!wasMember) return;

  socket.leave(roomId);
  const participants = await listParticipants(io, roomId);
  io.to(roomId).emit('presence:update', { participants, event: { type: 'left', participant } });
}

function sanitizeDescription(value: unknown): SessionDescriptionPayload | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const { type, sdp } = value as { type?: unknown; sdp?: unknown };
  if (
    typeof type !== 'string' ||
    !SDP_TYPES.has(type) ||
    typeof sdp !== 'string' ||
    sdp.length > LIMITS.maxSdpLength
  ) {
    return undefined;
  }
  return { type: type as SessionDescriptionPayload['type'], sdp };
}

function sanitizeCandidate(value: unknown): IceCandidatePayload | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const { candidate, sdpMid, sdpMLineIndex } = value as {
    candidate?: unknown;
    sdpMid?: unknown;
    sdpMLineIndex?: unknown;
  };
  if (typeof candidate !== 'string' || candidate.length > LIMITS.maxIceCandidateLength) {
    return undefined;
  }
  return {
    candidate,
    sdpMid: typeof sdpMid === 'string' ? sdpMid : null,
    sdpMLineIndex: Number.isInteger(sdpMLineIndex) ? (sdpMLineIndex as number) : null,
  };
}

/**
 * Wraps a client event handler so that errors become coded acknowledgements instead of
 * crashing the socket. The handler receives the arguments exactly as the client sent them.
 */
function guard<E extends ClientEvent>(
  socket: RoomSocket,
  event: E,
  handler: (...args: ClientEventArgs<E>) => Promise<void>
) {
  return async (...args: ClientEventArgs<E>): Promise<void> => {
    try {
      await handler(...args);
    } catch (err) {
      const ack: unknown = args[args.length - 1];
      if (err instanceof HttpError) {
        fail(ack, err.code, err.message);
        return;
      }
      console.error(`[socket ${socket.id}] ${event} failed:`, err);
      fail(ack, ERROR_CODES.INTERNAL_ERROR, 'Something went wrong. Please try again.');
    }
  };
}

/**
 * Registers every realtime room event for one socket. Each socket holds at most one
 * room at a time, and every handler that touches room state checks membership first.
 */
export function registerRoomHandlers(
  io: RoomServer,
  socket: RoomSocket,
  { maxRoomParticipants }: Pick<Config, 'maxRoomParticipants'>
): void {
  const limits = {
    chat: createRateLimiter({ capacity: 5, refillPerSecond: 1 }),
    playback: createRateLimiter({ capacity: 20, refillPerSecond: 5 }),
    signal: createRateLimiter({ capacity: 400, refillPerSecond: 200 }),
  };

  const requireRoom = (): string => {
    const roomId = socket.data.roomId;
    if (!roomId || !socket.rooms.has(roomId)) {
      throw new HttpError(409, ERROR_CODES.NOT_IN_ROOM, 'Join a room first');
    }
    return roomId;
  };

  socket.on(
    'room:join',
    guard(socket, 'room:join', async (request, ack) => {
      const roomId = normalizeRoomId(request?.roomId);
      if (!roomId) throw new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');

      if (socket.data.roomId && socket.data.roomId !== roomId) {
        await leaveRoom(io, socket);
      }
      const alreadyJoined = socket.data.roomId === roomId && socket.rooms.has(roomId);

      const room = await findRoomForSnapshot(roomId);
      if (!room) throw new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'Room not found');

      if (!alreadyJoined) {
        const occupants = await io.in(roomId).fetchSockets();
        if (occupants.length >= maxRoomParticipants) {
          throw new HttpError(409, ERROR_CODES.ROOM_FULL, `This room already has ${maxRoomParticipants} participants`);
        }

        socket.data.roomId = roomId;
        socket.data.muted = !(request?.muted === false);
        socket.data.joinedAt = Date.now();
        socket.join(roomId);
      }

      const participants = await listParticipants(io, roomId);
      if (!alreadyJoined) {
        socket.to(roomId).emit('presence:update', {
          participants,
          event: { type: 'joined', participant: toParticipant(socket.id, socket.data) },
        });
      }

      reply(ack, {
        selfId: socket.id,
        snapshot: {
          roomId: room.roomId,
          name: room.name,
          owner: room.owner,
          ownerId: String(room.ownerId),
          participants,
          messages: (room.messages ?? []).map(toMessageDTO),
          playback: toPlaybackDTO(room.playback),
          serverTime: Date.now(),
        },
      });
    })
  );

  socket.on(
    'room:leave',
    guard(socket, 'room:leave', async (ack) => {
      await leaveRoom(io, socket);
      reply(ack);
    })
  );

  socket.on(
    'room:mute',
    guard(socket, 'room:mute', async (request, ack) => {
      const roomId = requireRoom();
      socket.data.muted = requireBoolean(request?.muted, 'muted');

      const participants = await listParticipants(io, roomId);
      io.to(roomId).emit('presence:update', { participants });
      reply(ack);
    })
  );

  socket.on(
    'room:kick',
    guard(socket, 'room:kick', async (request, ack) => {
      const roomId = requireRoom();
      const room = await findRoom(roomId);
      if (!room) throw new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'This room no longer exists');
      if (String(room.ownerId) !== socket.data.user.id) {
        throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'Only the room owner can remove participants');
      }

      const targetId = typeof request?.socketId === 'string' ? request.socketId : '';
      if (!targetId || targetId === socket.id) {
        throw new HttpError(400, ERROR_CODES.VALIDATION_ERROR, 'Choose another participant to remove');
      }

      const [target] = await io.in(targetId).fetchSockets();
      if (!target || !target.rooms.has(roomId)) {
        throw new HttpError(404, ERROR_CODES.NOT_IN_ROOM, 'That participant is no longer in the room');
      }

      const participant = toParticipant(target.id, target.data);
      io.to(targetId).emit('room:kicked', { roomId });
      io.in(targetId).socketsLeave(roomId);

      const participants = await listParticipants(io, roomId, targetId);
      io.to(roomId).emit('presence:update', { participants, event: { type: 'left', participant } });
      reply(ack);
    })
  );

  socket.on(
    'chat:send',
    guard(socket, 'chat:send', async (request, ack) => {
      const roomId = requireRoom();
      if (!limits.chat.take()) {
        throw new HttpError(429, ERROR_CODES.RATE_LIMITED, 'You are sending messages too quickly');
      }

      const text = normalizeMessageText(request?.text, LIMITS.maxMessageLength);
      const message = await appendMessage(roomId, {
        userId: socket.data.user.id,
        username: socket.data.user.username,
        text,
      });
      if (!message) throw new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'This room no longer exists');

      const dto = toMessageDTO(message);
      io.to(roomId).emit('chat:message', dto);
      reply(ack, { message: dto });
    })
  );

  socket.on(
    'playback:set-source',
    guard(socket, 'playback:set-source', async (request, ack) => {
      const roomId = requireRoom();
      if (!limits.playback.take()) {
        throw new HttpError(429, ERROR_CODES.RATE_LIMITED, 'Too many playback changes. Slow down a little.');
      }

      const source = parseMediaSource(request?.url);
      const playback = await updatePlayback(roomId, {
        source,
        playing: true,
        position: source.startAt,
      });
      if (!playback) throw new HttpError(404, ERROR_CODES.ROOM_NOT_FOUND, 'This room no longer exists');

      const dto = toPlaybackDTO(playback);
      io.to(roomId).emit('playback:state', dto);
      reply(ack, { playback: dto });
    })
  );

  socket.on(
    'playback:control',
    guard(socket, 'playback:control', async (request, ack) => {
      const roomId = requireRoom();
      if (!limits.playback.take()) {
        throw new HttpError(429, ERROR_CODES.RATE_LIMITED, 'Too many playback changes. Slow down a little.');
      }

      const playing = requireBoolean(request?.playing, 'playing');
      const position = requirePosition(request?.position);
      const playback = await updatePlayback(roomId, { playing, position }, { requireSource: true });
      if (!playback) throw new HttpError(409, ERROR_CODES.NO_MEDIA, 'Load a video or audio source first');

      const dto = toPlaybackDTO(playback);
      io.to(roomId).emit('playback:state', dto);
      reply(ack, { playback: dto });
    })
  );

  // WebRTC signalling is relayed only between sockets that share a room. Each sender's relays run
  // one at a time, so a peer receives an offer before the candidates that belong to it.
  const relaySignal = async (request: SignalRequest): Promise<void> => {
    const roomId = socket.data.roomId;
    if (!roomId || !socket.rooms.has(roomId) || !limits.signal.take()) return;

    const to = request?.to;
    if (typeof to !== 'string' || to === socket.id) return;

    const description = sanitizeDescription(request.description);
    const candidate = sanitizeCandidate(request.candidate);
    if (!description && !candidate) return;

    const [target] = await io.in(to).fetchSockets();
    if (!target || !target.rooms.has(roomId)) return;

    io.to(to).emit('rtc:signal', { from: socket.id, description, candidate });
  };

  let signalChain: Promise<void> = Promise.resolve();
  socket.on('rtc:signal', (request) => {
    signalChain = signalChain
      .then(() => relaySignal(request))
      .catch((err: unknown) => console.error(`[socket ${socket.id}] rtc:signal failed:`, err));
  });

  socket.on('disconnecting', () => {
    leaveRoom(io, socket).catch((err: unknown) => console.error(`[socket ${socket.id}] leave failed:`, err));
  });
}
