'use strict';

const roomService = require('../services/roomService');
const { normalizeRoomId } = require('../lib/ids');
const { parseMediaSource } = require('../lib/mediaSource');
const { createRateLimiter } = require('../lib/rateLimiter');
const { HttpError } = require('../lib/httpError');
const { normalizeMessageText, requireBoolean, requirePosition } = require('../lib/validation');
const { MAX_MESSAGE_LENGTH, MAX_SDP_LENGTH, MAX_ICE_CANDIDATE_LENGTH } = require('../lib/limits');

const SDP_TYPES = new Set(['offer', 'answer', 'pranswer', 'rollback']);

function reply(ack, payload = {}) {
  if (typeof ack === 'function') ack({ ok: true, ...payload });
}

function fail(ack, code, message) {
  if (typeof ack === 'function') ack({ ok: false, code, message });
}

function toParticipant(socketId, data) {
  return {
    socketId,
    userId: data.user.id,
    username: data.user.username,
    muted: Boolean(data.muted),
    joinedAt: data.joinedAt,
  };
}

/** Presence is derived from live sockets, so it stays correct across restarts and multiple nodes. */
async function listParticipants(io, roomId, excludeId = null) {
  const sockets = await io.in(roomId).fetchSockets();
  return sockets
    .filter((remote) => remote.id !== excludeId && remote.data.roomId === roomId)
    .map((remote) => toParticipant(remote.id, remote.data))
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

async function leaveRoom(io, socket) {
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

function sanitizeDescription(value) {
  if (!value || typeof value !== 'object') return undefined;
  if (!SDP_TYPES.has(value.type) || typeof value.sdp !== 'string' || value.sdp.length > MAX_SDP_LENGTH) {
    return undefined;
  }
  return { type: value.type, sdp: value.sdp };
}

function sanitizeCandidate(value) {
  if (!value || typeof value !== 'object') return undefined;
  if (typeof value.candidate !== 'string' || value.candidate.length > MAX_ICE_CANDIDATE_LENGTH) {
    return undefined;
  }
  return {
    candidate: value.candidate,
    sdpMid: typeof value.sdpMid === 'string' ? value.sdpMid : null,
    sdpMLineIndex: Number.isInteger(value.sdpMLineIndex) ? value.sdpMLineIndex : null,
  };
}

/**
 * Registers every realtime room event for one socket. Each socket holds at most one
 * room at a time, and every handler that touches room state checks membership first.
 */
function registerRoomHandlers(io, socket, { maxRoomParticipants }) {
  const limits = {
    chat: createRateLimiter({ capacity: 5, refillPerSecond: 1 }),
    playback: createRateLimiter({ capacity: 20, refillPerSecond: 5 }),
    signal: createRateLimiter({ capacity: 400, refillPerSecond: 200 }),
  };

  const requireRoom = () => {
    const roomId = socket.data.roomId;
    if (!roomId || !socket.rooms.has(roomId)) throw new HttpError(409, 'NOT_IN_ROOM', 'Join a room first');
    return roomId;
  };

  const on = (event, handler) => {
    socket.on(event, async (...args) => {
      const ack = typeof args[args.length - 1] === 'function' ? args.pop() : undefined;
      try {
        await handler(args[0], ack);
      } catch (err) {
        if (err instanceof HttpError) {
          fail(ack, err.code, err.message);
          return;
        }
        console.error(`[socket ${socket.id}] ${event} failed:`, err);
        fail(ack, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
      }
    });
  };

  on('room:join', async (payload, ack) => {
    const roomId = normalizeRoomId(payload && payload.roomId);
    if (!roomId) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found');

    if (socket.data.roomId && socket.data.roomId !== roomId) {
      await leaveRoom(io, socket);
    }
    const alreadyJoined = socket.data.roomId === roomId && socket.rooms.has(roomId);

    const room = await roomService.findRoomForSnapshot(roomId);
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'Room not found');

    if (!alreadyJoined) {
      const occupants = await io.in(roomId).fetchSockets();
      if (occupants.length >= maxRoomParticipants) {
        throw new HttpError(409, 'ROOM_FULL', `This room already has ${maxRoomParticipants} participants`);
      }

      socket.data.roomId = roomId;
      socket.data.muted = !(payload && payload.muted === false);
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
        messages: (room.messages || []).map(roomService.toMessageDTO),
        playback: roomService.toPlaybackDTO(room.playback),
        serverTime: Date.now(),
      },
    });
  });

  on('room:leave', async (_payload, ack) => {
    await leaveRoom(io, socket);
    reply(ack);
  });

  on('room:mute', async (payload, ack) => {
    const roomId = requireRoom();
    socket.data.muted = requireBoolean(payload && payload.muted, 'muted');

    const participants = await listParticipants(io, roomId);
    io.to(roomId).emit('presence:update', { participants });
    reply(ack);
  });

  on('room:kick', async (payload, ack) => {
    const roomId = requireRoom();
    const room = await roomService.findRoom(roomId);
    if (!room) throw new HttpError(404, 'ROOM_NOT_FOUND', 'This room no longer exists');
    if (String(room.ownerId) !== socket.data.user.id) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the room owner can remove participants');
    }

    const targetId = payload && typeof payload.socketId === 'string' ? payload.socketId : '';
    if (!targetId || targetId === socket.id) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Choose another participant to remove');
    }

    const [target] = await io.in(targetId).fetchSockets();
    if (!target || !target.rooms.has(roomId)) {
      throw new HttpError(404, 'NOT_IN_ROOM', 'That participant is no longer in the room');
    }

    const participant = toParticipant(target.id, target.data);
    io.to(targetId).emit('room:kicked', { roomId });
    io.in(targetId).socketsLeave(roomId);

    const participants = await listParticipants(io, roomId, targetId);
    io.to(roomId).emit('presence:update', { participants, event: { type: 'left', participant } });
    reply(ack);
  });

  on('chat:send', async (payload, ack) => {
    const roomId = requireRoom();
    if (!limits.chat.take()) {
      throw new HttpError(429, 'RATE_LIMITED', 'You are sending messages too quickly');
    }

    const text = normalizeMessageText(payload && payload.text, MAX_MESSAGE_LENGTH);
    const message = await roomService.appendMessage(roomId, {
      userId: socket.data.user.id,
      username: socket.data.user.username,
      text,
    });
    if (!message) throw new HttpError(404, 'ROOM_NOT_FOUND', 'This room no longer exists');

    const dto = roomService.toMessageDTO(message);
    io.to(roomId).emit('chat:message', dto);
    reply(ack, { message: dto });
  });

  on('playback:set-source', async (payload, ack) => {
    const roomId = requireRoom();
    if (!limits.playback.take()) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many playback changes. Slow down a little.');
    }

    const source = parseMediaSource(payload && payload.url);
    const playback = await roomService.updatePlayback(roomId, {
      source,
      playing: true,
      position: source.startAt,
    });
    if (!playback) throw new HttpError(404, 'ROOM_NOT_FOUND', 'This room no longer exists');

    const dto = roomService.toPlaybackDTO(playback);
    io.to(roomId).emit('playback:state', dto);
    reply(ack, { playback: dto });
  });

  on('playback:control', async (payload, ack) => {
    const roomId = requireRoom();
    if (!limits.playback.take()) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many playback changes. Slow down a little.');
    }

    const playing = requireBoolean(payload && payload.playing, 'playing');
    const position = requirePosition(payload && payload.position);
    const playback = await roomService.updatePlayback(roomId, { playing, position }, { requireSource: true });
    if (!playback) throw new HttpError(409, 'NO_MEDIA', 'Load a video or audio source first');

    const dto = roomService.toPlaybackDTO(playback);
    io.to(roomId).emit('playback:state', dto);
    reply(ack, { playback: dto });
  });

  // WebRTC signalling is relayed only between sockets that share a room.
  socket.on('rtc:signal', async (payload) => {
    const roomId = socket.data.roomId;
    if (!roomId || !socket.rooms.has(roomId) || !limits.signal.take()) return;

    const to = payload && payload.to;
    if (typeof to !== 'string' || to === socket.id) return;

    const description = sanitizeDescription(payload.description);
    const candidate = sanitizeCandidate(payload.candidate);
    if (!description && !candidate) return;

    const [target] = await io.in(to).fetchSockets();
    if (!target || !target.rooms.has(roomId)) return;

    io.to(to).emit('rtc:signal', { from: socket.id, description, candidate });
  });

  socket.on('disconnecting', () => {
    leaveRoom(io, socket).catch((err) => console.error(`[socket ${socket.id}] leave failed:`, err));
  });
}

module.exports = { registerRoomHandlers, listParticipants };
