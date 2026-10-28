'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/testServer');
const { api, createAccount, connectSocket, emit } = require('../helpers/client');

describe('room capacity', () => {
  let server;
  const sockets = [];

  before(async () => {
    server = await startTestServer({ maxRoomParticipants: 2 });
  });

  after(async () => {
    sockets.forEach((socket) => socket.close());
    await server.stop();
  });

  it('refuses joins beyond MAX_ROOM_PARTICIPANTS with ROOM_FULL', async () => {
    const owner = await createAccount(server.baseUrl, 'capacity');
    const created = await api(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: { name: 'Small' } });
    const roomId = created.body.roomId;

    for (let i = 0; i < 2; i += 1) {
      const member = await createAccount(server.baseUrl, `member${i}`);
      const socket = await connectSocket(server.baseUrl, member.token);
      sockets.push(socket);
      const joined = await emit(socket, 'room:join', { roomId });
      assert.equal(joined.ok, true);
    }

    const overflow = await createAccount(server.baseUrl, 'overflow');
    const overflowSocket = await connectSocket(server.baseUrl, overflow.token);
    sockets.push(overflowSocket);
    const refused = await emit(overflowSocket, 'room:join', { roomId });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'ROOM_FULL');
  });
});
