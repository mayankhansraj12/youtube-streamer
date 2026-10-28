'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/testServer');
const { api, createAccount, connectSocket, emit } = require('../helpers/client');

async function waitUntil(predicate, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('signal relay ordering', () => {
  let server;
  const sockets = [];

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    sockets.forEach((socket) => socket.close());
    await server.stop();
  });

  it('delivers an offer before the candidates that a sender emits right after it', async () => {
    const first = await createAccount(server.baseUrl, 'order_first');
    const second = await createAccount(server.baseUrl, 'order_second');
    const created = await api(server.baseUrl, 'POST', '/api/rooms', { token: first.token, body: {} });

    const sender = await connectSocket(server.baseUrl, first.token);
    const receiver = await connectSocket(server.baseUrl, second.token);
    sockets.push(sender, receiver);
    await emit(sender, 'room:join', { roomId: created.body.roomId });
    await emit(receiver, 'room:join', { roomId: created.body.roomId });

    const received = [];
    receiver.on('rtc:signal', (payload) => received.push(payload.description ? 'offer' : 'candidate'));

    sender.emit('rtc:signal', { to: receiver.id, description: { type: 'offer', sdp: 'v=0' } });
    for (let i = 0; i < 25; i += 1) {
      sender.emit('rtc:signal', {
        to: receiver.id,
        candidate: { candidate: `candidate:${i} 1 udp 1 127.0.0.1 9 typ host`, sdpMid: '0', sdpMLineIndex: 0 },
      });
    }

    await waitUntil(() => received.length === 26);
    assert.equal(received[0], 'offer');
    assert.equal(received.filter((kind) => kind === 'candidate').length, 25);
  });
});
