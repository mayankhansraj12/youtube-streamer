import { io, type Socket } from 'socket.io-client';
import type {
  AckReply,
  ChatSendReply,
  ChatSendRequest,
  ClientToServerEvents,
  ControlRequest,
  Empty,
  JoinReply,
  JoinRequest,
  KickRequest,
  MuteRequest,
  PlaybackReply,
  ServerToClientEvents,
  SetSourceRequest,
} from '@streamsync/shared';
import { API_BASE_URL } from '../config';

const ACK_TIMEOUT_MS = 8000;

/** The realtime connection, typed by the event contract the API implements. */
export type RoomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Request and reply types for each client event that the server acknowledges. */
export interface RequestContract {
  'room:join': { request: JoinRequest; reply: JoinReply };
  'room:leave': { request: undefined; reply: Empty };
  'room:mute': { request: MuteRequest; reply: Empty };
  'room:kick': { request: KickRequest; reply: Empty };
  'chat:send': { request: ChatSendRequest; reply: ChatSendReply };
  'playback:set-source': { request: SetSourceRequest; reply: PlaybackReply };
  'playback:control': { request: ControlRequest; reply: PlaybackReply };
}

/** The part of a timed socket emitter that `request` uses. */
interface TimedEmitter {
  emit(event: string, ...args: unknown[]): unknown;
}

let current: { token: string; socket: RoomSocket } | null = null;

/**
 * Returns the single socket for a session token, creating it on first use. The socket is
 * returned unconnected; the provider decides when to connect.
 */
export function getSocket(token: string): RoomSocket {
  if (current && current.token === token) return current.socket;

  current?.socket.disconnect();
  // socket.io-client types io() without event names, so the shared contract is applied here.
  const socket = io(API_BASE_URL || window.location.origin, {
    autoConnect: false,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 5000,
  }) as RoomSocket;
  current = { token, socket };
  return socket;
}

export function disposeSocket(): void {
  current?.socket.disconnect();
  current = null;
}

export class SocketRequestError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SocketRequestError';
    this.code = code;
  }
}

/**
 * Emits an event that the server answers with an acknowledgement, and rejects on failure or timeout.
 * An undefined payload is not sent at all, so events without fields send only the callback.
 */
export function request<E extends keyof RequestContract>(
  socket: RoomSocket,
  event: E,
  payload?: RequestContract[E]['request']
): Promise<{ ok: true } & RequestContract[E]['reply']> {
  return new Promise((resolve, reject) => {
    const onReply = (error: Error | null, reply: AckReply<RequestContract[E]['reply']>) => {
      if (error) {
        reject(new SocketRequestError('TIMEOUT', 'The server did not respond. Please try again.'));
        return;
      }
      if (!reply.ok) {
        reject(new SocketRequestError(reply.code, reply.message));
        return;
      }
      resolve(reply);
    };

    // A timed emitter cannot be typed per event name, so the call goes through this narrower view.
    const timed = socket.timeout(ACK_TIMEOUT_MS) as unknown as TimedEmitter;
    timed.emit(event, ...(payload === undefined ? [] : [payload]), onReply);
  });
}
