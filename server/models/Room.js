'use strict';

const mongoose = require('mongoose');
const { MAX_MESSAGE_LENGTH, MAX_ROOM_NAME_LENGTH, DEFAULT_ROOM_NAME } = require('../lib/limits');

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true, maxlength: 24 },
    text: { type: String, required: true, maxlength: MAX_MESSAGE_LENGTH },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const sourceSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['youtube', 'media'], required: true },
    url: { type: String, required: true, maxlength: 2048 },
    youtubeId: { type: String },
    mediaType: { type: String, enum: ['audio', 'video'] },
    format: { type: String, enum: ['native', 'hls'] },
    startAt: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// The authoritative playback timeline. Clients project `position` forward using `updatedAt`.
const playbackSchema = new mongoose.Schema(
  {
    source: { type: sourceSchema, default: null },
    playing: { type: Boolean, default: false },
    position: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, immutable: true, trim: true },
    name: { type: String, default: DEFAULT_ROOM_NAME, trim: true, maxlength: MAX_ROOM_NAME_LENGTH },
    owner: { type: String, required: true, maxlength: 24 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: { type: [messageSchema], default: [] },
    playback: { type: playbackSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Room', roomSchema);
