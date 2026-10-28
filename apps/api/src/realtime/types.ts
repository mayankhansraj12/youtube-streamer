import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@streamsync/shared';
import type { SessionUser } from '../lib/session-token.js';

/** Per-socket state. `user` comes from the verified token; the room fields are set when the socket joins. */
export interface SocketData {
  user: SessionUser;
  roomId?: string | null;
  muted?: boolean;
  joinedAt?: number;
}

export type RoomServer = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
export type RoomSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;
