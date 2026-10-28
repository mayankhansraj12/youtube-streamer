/** Room state as sent to and rendered by clients. */

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
  /** Server epoch milliseconds. */
  createdAt: number;
}

export type MediaSource =
  | { kind: 'youtube'; url: string; youtubeId: string; startAt: number }
  | {
      kind: 'media';
      url: string;
      mediaType: 'audio' | 'video';
      format: 'native' | 'hls';
      startAt: number;
    };

export interface PlaybackState {
  source: MediaSource | null;
  playing: boolean;
  /** Seconds into the media at the moment `updatedAt` was recorded. */
  position: number;
  /** Server epoch milliseconds. Compare against the server clock, never the local one. */
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

export interface PresenceEvent {
  type: 'joined' | 'left';
  participant: Participant;
}

export interface PresenceUpdate {
  participants: Participant[];
  event?: PresenceEvent;
}

export interface SessionDescriptionPayload {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp: string;
}

export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

/** A WebRTC signal as delivered to the peer it was relayed to. */
export interface SignalRelay {
  from: string;
  description?: SessionDescriptionPayload;
  candidate?: IceCandidatePayload;
}

export interface RoomEndedEvent {
  roomId: string;
  reason: string;
}

export interface RoomKickedEvent {
  roomId: string;
}
