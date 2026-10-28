import type { ChatMessage, PublicUser, SignalRelay } from '@streamsync/shared';

// Room, playback and presence shapes come from the contract shared with the API.
export type {
  ChatMessage,
  MediaSource,
  Participant,
  PlaybackState,
  PresenceUpdate,
  RoomSnapshot,
  RoomSummary,
} from '@streamsync/shared';

/** The signed-in account as the API returns it. */
export type AuthUser = PublicUser;

/** A chat-panel entry: either a participant's message or a system notice such as "Ana joined". */
export type ChatItem =
  | ({ kind: 'message' } & ChatMessage)
  | { kind: 'system'; id: string; text: string; createdAt: number };

/** A WebRTC signal as relayed by the server to this client. */
export type SignalPayload = SignalRelay;
