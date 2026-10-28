import { io as createSocketClient, type Socket } from 'socket.io-client';
import type { AuthSession, ClientToServerEvents, ErrorCode, ServerToClientEvents } from '@streamsync/shared';

export const PASSWORD = 'correct-horse-battery';
let sequence = 0;

export interface Account {
  username: string;
  id: string;
  token: string;
}

export interface ApiOptions {
  token?: string;
  body?: unknown;
  rawBody?: string;
}

export interface ApiResponse<TBody> {
  status: number;
  body: TBody;
}

/** A socket that has connected. The server assigns its id before the connect event fires. */
export type ConnectedSocket = Socket & { id: string };

type ClientEvent = keyof ClientToServerEvents;
type ServerEvent = keyof ServerToClientEvents;

/** The request an event takes. Events that only take an acknowledgement take none. */
type RequestOf<E extends ClientEvent> = Parameters<ClientToServerEvents[E]> extends [infer First, ...unknown[]]
  ? First extends (...args: never[]) => unknown
    ? undefined
    : First
  : undefined;

/** The acknowledgement callback an event receives as its last argument. */
type AckOf<E extends ClientEvent> = Parameters<ClientToServerEvents[E]> extends [...unknown[], infer Last] ? Last : never;

/**
 * What an event replies with: the success fields, or a coded failure. `code` is readable on
 * both branches, so a test can check a failure code without first narrowing on `ok`.
 */
export type ReplyOf<E extends ClientEvent> = (AckOf<E> extends (reply: infer R) => unknown ? R : never) & {
  code?: ErrorCode;
};

/** The payload a server event delivers. */
type PayloadOf<E extends ServerEvent> = Parameters<ServerToClientEvents[E]>[0];

export const uniqueUsername = (prefix: string): string => `${prefix}${Date.now().toString(36)}${(sequence += 1)}`;

/** Calls the REST API. The caller names the body type it expects; the tests assert its fields. */
export async function api<TBody = unknown>(
  baseUrl: string,
  method: string,
  path: string,
  { token, body, rawBody }: ApiOptions = {}
): Promise<ApiResponse<TBody>> {
  const headers: Record<string, string> = {};
  if (body !== undefined || rawBody !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as TBody };
}

export async function createAccount(baseUrl: string, prefix = 'user'): Promise<Account> {
  const username = uniqueUsername(prefix);
  const res = await api<AuthSession>(baseUrl, 'POST', '/api/auth/signup', {
    body: { username, email: `${username}@example.com`, password: PASSWORD },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { username, id: res.body.user.id, token: res.body.token };
}

export function connectSocket(baseUrl: string, token: string | undefined): Promise<ConnectedSocket> {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket as ConnectedSocket));
    socket.once('connect_error', (err: Error) => {
      socket.close();
      reject(err);
    });
  });
}

/** Emits with an acknowledgement and a timeout, resolving with the server's reply. */
export function emit<E extends ClientEvent>(
  socket: ConnectedSocket,
  event: E,
  payload?: RequestOf<E>
): Promise<ReplyOf<E>> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(3000)
      .emit(event, payload, (err: Error | null, response: ReplyOf<E>) => (err ? reject(err) : resolve(response)));
  });
}

/** Resolves with the next matching event. Register it before triggering the action that causes it. */
export function nextEvent<E extends ServerEvent>(
  socket: ConnectedSocket,
  event: E,
  predicate: (payload: PayloadOf<E>) => unknown = () => true,
  timeoutMs = 3000
): Promise<PayloadOf<E>> {
  // socket.io cannot resolve its listener type for a generic event name, so the name is widened here.
  const eventName: string = event;
  return new Promise((resolve, reject) => {
    const handler = (payload: PayloadOf<E>): void => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    socket.on(eventName, handler);
  });
}
