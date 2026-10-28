import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config';

const ACK_TIMEOUT_MS = 8000;

let current: { token: string; socket: Socket } | null = null;

/**
 * Returns the single socket for a session token, creating it on first use. The socket is
 * returned unconnected; the provider decides when to connect.
 */
export function getSocket(token: string): Socket {
  if (current && current.token === token) return current.socket;

  current?.socket.disconnect();
  const socket = io(API_BASE_URL || window.location.origin, {
    autoConnect: false,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 5000,
  });
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

type AckReply<T> = ({ ok: true } & T) | { ok: false; code: string; message: string };

/** Emits an event that the server answers with an acknowledgement, and rejects on failure or timeout. */
export function request<T extends object>(socket: Socket, event: string, payload?: unknown): Promise<{ ok: true } & T> {
  return new Promise((resolve, reject) => {
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (error: Error | null, reply: AckReply<T>) => {
      if (error) {
        reject(new SocketRequestError('TIMEOUT', 'The server did not respond. Please try again.'));
        return;
      }
      if (!reply.ok) {
        reject(new SocketRequestError(reply.code, reply.message));
        return;
      }
      resolve(reply);
    });
  });
}
