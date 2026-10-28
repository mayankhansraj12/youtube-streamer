export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  createdAt?: string;
}

export interface Participant {
  socketId: string;
  userId: string;
  username: string;
  muted: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: number;
}

/** A chat-panel entry: either a participant's message or a system notice such as "Ana joined". */
export type ChatItem =
  | ({ kind: 'message' } & ChatMessage)
  | { kind: 'system'; id: string; text: string; createdAt: number };

export type MediaSource =
  | { kind: 'youtube'; url: string; youtubeId: string; startAt: number }
  | { kind: 'media'; url: string; mediaType: 'audio' | 'video'; format: 'native' | 'hls'; startAt: number };

export interface PlaybackState {
  source: MediaSource | null;
  playing: boolean;
  /** Seconds into the media at the moment `updatedAt` was recorded. */
  position: number;
  /** Server epoch milliseconds. Compare with the server clock, not the local one. */
  updatedAt: number;
}

export interface RoomSnapshot {
  roomId: string;
  name: string;
  owner: string;
  ownerId: string;
  participants: Participant[];
  messages: ChatMessage[];
  playback: PlaybackState;
  serverTime: number;
}

export interface PresenceUpdate {
  participants: Participant[];
  event?: { type: 'joined' | 'left'; participant: Participant };
}

export interface RoomSummary {
  roomId: string;
  name: string;
  owner: string;
  ownerId: string;
  createdAt: string;
}

export interface SignalPayload {
  from: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
