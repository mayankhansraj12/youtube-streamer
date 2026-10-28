'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer } = require('../helpers/testServer');
const { api, createAccount, connectSocket, emit, nextEvent } = require('../helpers/client');

describe('room REST API', () => {
  let server;

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    await server.stop();
  });

  it('creates rooms with sanitised names and generated ids', async () => {
    const owner = await createAccount(server.baseUrl, 'roomowner');
    const res = await api(server.baseUrl, 'POST', '/api/rooms', {
      token: owner.token,
      body: { name: '   Movie    night  ' },
    });

    assert.equal(res.status, 201);
    assert.match(res.body.roomId, /^[a-z0-9]{8}$/);
    assert.equal(res.body.name, 'Movie night');
    assert.equal(res.body.ownerId, owner.id);

    const fetched = await api(server.baseUrl, 'GET', `/api/rooms/${res.body.roomId.toUpperCase()}`, { token: owner.token });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.name, 'Movie night');
  });

  it('falls back to the default name when none is given', async () => {
    const owner = await createAccount(server.baseUrl, 'defaultname');
    const res = await api(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: {} });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Untitled Room');
  });

  it('returns 404 for unknown or malformed room ids and requires a session', async () => {
    const owner = await createAccount(server.baseUrl, 'lookup');

    const missing = await api(server.baseUrl, 'GET', '/api/rooms/zzzzzzzz', { token: owner.token });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'ROOM_NOT_FOUND');

    const malformed = await api(server.baseUrl, 'GET', '/api/rooms/..%2Fsecrets', { token: owner.token });
    assert.equal(malformed.status, 404);

    const anonymous = await api(server.baseUrl, 'POST', '/api/rooms', { body: {} });
    assert.equal(anonymous.status, 401);
  });

  it('lets only the owner end a room, and notifies everyone still inside it', async () => {
    const owner = await createAccount(server.baseUrl, 'ender');
    const guest = await createAccount(server.baseUrl, 'lurker');

    const created = await api(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: { name: 'Doomed' } });
    const roomId = created.body.roomId;

    const guestSocket = await connectSocket(server.baseUrl, guest.token);
    const joined = await emit(guestSocket, 'room:join', { roomId, muted: true });
    assert.equal(joined.ok, true);

    const forbidden = await api(server.baseUrl, 'DELETE', `/api/rooms/${roomId}`, { token: guest.token });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    const ended = nextEvent(guestSocket, 'room:ended');
    const deleted = await api(server.baseUrl, 'DELETE', `/api/rooms/${roomId}`, { token: owner.token });
    assert.equal(deleted.status, 204);

    const payload = await ended;
    assert.equal(payload.roomId, roomId);

    const gone = await api(server.baseUrl, 'GET', `/api/rooms/${roomId}`, { token: owner.token });
    assert.equal(gone.status, 404);

    guestSocket.close();
  });
});
