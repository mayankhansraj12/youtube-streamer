'use strict';

const mongoose = require('mongoose');
const Room = require('../models/Room');
const { generateRoomId } = require('../lib/ids');
const { MAX_STORED_MESSAGES, SNAPSHOT_MESSAGE_COUNT } = require('../lib/limits');

const DUPLICATE_KEY_ERROR = 11000;
const MAX_ID_ATTEMPTS = 5;

async function createRoom({ name, owner, ownerId }) {
  let lastError = null;
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await Room.create({ roomId: generateRoomId(), name, owner, ownerId });
    } catch (err) {
      if (err.code !== DUPLICATE_KEY_ERROR) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

function findRoom(roomId) {
  return Room.findOne({ roomId }).select('roomId name owner ownerId createdAt').lean();
}

/** Loads everything a client needs to render a room the moment it joins. */
function findRoomForSnapshot(roomId) {
  return Room.findOne({ roomId })
    .select('roomId name owner ownerId playback')
    .slice('messages', -SNAPSHOT_MESSAGE_COUNT)
    .lean();
}

async function appendMessage(roomId, { userId, username, text }) {
  const message = {
    _id: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(userId),
    username,
    text,
    createdAt: new Date(),
  };
  const result = await Room.updateOne(
    { roomId },
    { $push: { messages: { $each: [message], $slice: -MAX_STORED_MESSAGES } } }
  );
  return result.matchedCount === 1 ? message : null;
}

/**
 * Applies a partial playback update, stamps it with the server clock and resolves to the
 * resulting playback record. With `requireSource`, nothing is changed (resolves to null)
 * when no media is loaded.
 */
async function updatePlayback(roomId, changes, { requireSource = false } = {}) {
  const $set = { 'playback.updatedAt': new Date() };
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

async function deleteRoom(roomId) {
  const result = await Room.deleteOne({ roomId });
  return result.deletedCount === 1;
}

function toRoomDTO(room) {
  return {
    roomId: room.roomId,
    name: room.name,
    owner: room.owner,
    ownerId: String(room.ownerId),
    createdAt: new Date(room.createdAt).toISOString(),
  };
}

function toMessageDTO(message) {
  return {
    id: String(message._id),
    userId: String(message.userId),
    username: message.username,
    text: message.text,
    createdAt: new Date(message.createdAt).getTime(),
  };
}

function toSourceDTO(source) {
  if (!source) return null;
  return {
    kind: source.kind,
    url: source.url,
    youtubeId: source.youtubeId,
    mediaType: source.mediaType,
    format: source.format,
    startAt: source.startAt || 0,
  };
}

function toPlaybackDTO(playback) {
  return {
    source: toSourceDTO(playback && playback.source),
    playing: Boolean(playback && playback.playing),
    position: (playback && playback.position) || 0,
    updatedAt: new Date((playback && playback.updatedAt) || Date.now()).getTime(),
  };
}

module.exports = {
  createRoom,
  findRoom,
  findRoomForSnapshot,
  appendMessage,
  updatePlayback,
  deleteRoom,
  toRoomDTO,
  toMessageDTO,
  toPlaybackDTO,
};
