import type { ErrorCode } from './errors.js';
import type {
  ChatMessage,
  IceCandidatePayload,
  PlaybackState,
  PresenceUpdate,
  RoomEndedEvent,
  RoomKickedEvent,
  RoomSnapshot,
  SessionDescriptionPayload,
  SignalRelay,
} from './room.js';

/** Acknowledgement payloads are either the success fields or a coded failure. */
export type AckReply<T> = ({ ok: true } & T) | { ok: false; code: ErrorCode; message: string };

export type Ack<T> = (reply: AckReply<T>) => void;

export type Empty = Record<string, never>;

export interface JoinRequest {
  roomId: string;
  muted?: boolean;
}

export interface JoinReply {
  selfId: string;
  snapshot: RoomSnapshot;
}

export interface MuteRequest {
  muted: boolean;
}

export interface KickRequest {
  socketId: string;
}

export interface ChatSendRequest {
  text: string;
}

export interface ChatSendReply {
  message: ChatMessage;
}

export interface SetSourceRequest {
  url: string;
}

export interface ControlRequest {
  playing: boolean;
  position: number;
}

export interface PlaybackReply {
  playback: PlaybackState;
}

export interface SignalRequest {
  to: string;
  description?: SessionDescriptionPayload;
  candidate?: IceCandidatePayload;
}

/** Events a client emits. Every event that replies takes an acknowledgement callback last. */
export interface ClientToServerEvents {
  'room:join': (request: JoinRequest, ack: Ack<JoinReply>) => void;
  'room:leave': (ack: Ack<Empty>) => void;
  'room:mute': (request: MuteRequest, ack: Ack<Empty>) => void;
  'room:kick': (request: KickRequest, ack: Ack<Empty>) => void;
  'chat:send': (request: ChatSendRequest, ack: Ack<ChatSendReply>) => void;
  'playback:set-source': (request: SetSourceRequest, ack: Ack<PlaybackReply>) => void;
  'playback:control': (request: ControlRequest, ack: Ack<PlaybackReply>) => void;
  'rtc:signal': (request: SignalRequest) => void;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  'presence:update': (update: PresenceUpdate) => void;
  'chat:message': (message: ChatMessage) => void;
  'playback:state': (state: PlaybackState) => void;
  'rtc:signal': (signal: SignalRelay) => void;
  'room:ended': (event: RoomEndedEvent) => void;
  'room:kicked': (event: RoomKickedEvent) => void;
}
