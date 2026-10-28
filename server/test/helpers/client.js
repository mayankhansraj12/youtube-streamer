'use strict';

const { io: createSocketClient } = require('socket.io-client');

const PASSWORD = 'correct-horse-battery';
let sequence = 0;

const uniqueUsername = (prefix) => `${prefix}${Date.now().toString(36)}${(sequence += 1)}`;

async function api(baseUrl, method, path, { token, body, rawBody } = {}) {
  const headers = {};
  if (body !== undefined || rawBody !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function createAccount(baseUrl, prefix = 'user') {
  const username = uniqueUsername(prefix);
  const res = await api(baseUrl, 'POST', '/api/auth/signup', {
    body: { username, email: `${username}@example.com`, password: PASSWORD },
  });
  if (res.status !== 201) throw new Error(`signup failed: ${JSON.stringify(res.body)}`);
  return { username, id: res.body.user.id, token: res.body.token };
}

function connectSocket(baseUrl, token) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => {
      socket.close();
      reject(err);
    });
  });
}

/** Emits with an acknowledgement and a timeout, resolving with the server's reply. */
function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(3000).emit(event, payload, (err, response) => (err ? reject(err) : resolve(response)));
  });
}

/** Resolves with the next matching event. Register it before triggering the action that causes it. */
function nextEvent(socket, event, predicate = () => true, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    socket.on(event, handler);
  });
}

module.exports = { PASSWORD, uniqueUsername, api, createAccount, connectSocket, emit, nextEvent };
