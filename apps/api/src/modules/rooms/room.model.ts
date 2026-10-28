import mongoose, { type Types } from 'mongoose';
import { LIMITS, type MediaSource } from '@streamsync/shared';

export interface MessageRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  username: string;
  text: string;
  createdAt: Date;
}

export interface PlaybackRecord {
  source: MediaSource | null;
  playing: boolean;
  /** Seconds into the media at the moment `updatedAt` was recorded. */
  position: number;
  updatedAt: Date;
}

export interface RoomAttributes {
  roomId: string;
  name: string;
  owner: string;
  ownerId: Types.ObjectId;
  messages: MessageRecord[];
  playback: PlaybackRecord;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true, maxlength: LIMITS.maxUsernameLength },
    text: { type: String, required: true, maxlength: LIMITS.maxMessageLength },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const sourceSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['youtube', 'media'], required: true },
    url: { type: String, required: true, maxlength: LIMITS.maxUrlLength },
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
    name: { type: String, default: LIMITS.defaultRoomName, trim: true, maxlength: LIMITS.maxRoomNameLength },
    owner: { type: String, required: true, maxlength: LIMITS.maxUsernameLength },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: { type: [messageSchema], default: [] },
    playback: { type: playbackSchema, default: () => ({}) },
  },
  { timestamps: true, versionKey: false }
);

export const Room = mongoose.model<RoomAttributes>('Room', roomSchema);
