import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { RoomSummary } from '@streamsync/shared';
import { startTestServer, type TestServer } from '../helpers/testServer.js';
import {
  api,
  createAccount,
  connectSocket,
  emit,
  nextEvent,
  type ConnectedSocket,
} from '../helpers/client.js';

describe('owner moderation', () => {
  let server: TestServer;
  const sockets: ConnectedSocket[] = [];
  const track = async (token: string): Promise<ConnectedSocket> => {
    const socket = await connectSocket(server.baseUrl, token);
    sockets.push(socket);
    return socket;
  };

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    sockets.forEach((socket) => socket.close());
    await server.stop();
  });

  it('lets only the owner remove a participant, who is notified and then cut off', async () => {
    const owner = await createAccount(server.baseUrl, 'mod_owner');
    const guest = await createAccount(server.baseUrl, 'mod_guest');
    const created = await api<RoomSummary>(server.baseUrl, 'POST', '/api/rooms', {
      token: owner.token,
      body: { name: 'Moderated' },
    });
    const roomId = created.body.roomId;

    const ownerSocket = await track(owner.token);
    const guestSocket = await track(guest.token);
    await emit(ownerSocket, 'room:join', { roomId });
    const guestJoin = await emit(guestSocket, 'room:join', { roomId });
    assert.equal(guestJoin.ok, true);

    const refused = await emit(guestSocket, 'room:kick', { socketId: ownerSocket.id });
    assert.equal(refused.code, 'FORBIDDEN');

    const kicked = nextEvent(guestSocket, 'room:kicked');
    const left = nextEvent(ownerSocket, 'presence:update', (p) => p.event && p.event.type === 'left');
    const removed = await emit(ownerSocket, 'room:kick', { socketId: guestSocket.id });
    assert.equal(removed.ok, true);
    assert.equal((await kicked).roomId, roomId);

    const leftPayload = await left;
    assert.equal(leftPayload.event!.participant.username, guest.username);
    assert.equal(leftPayload.participants.length, 1);

    const chatWhileRemoved = await emit(guestSocket, 'chat:send', { text: 'still here?' });
    assert.equal(chatWhileRemoved.code, 'NOT_IN_ROOM');

    const leave = await emit(guestSocket, 'room:leave');
    assert.equal(leave.ok, true);
  });

  it('lets a removed participant rejoin with the room code', async () => {
    const owner = await createAccount(server.baseUrl, 'rejoin_owner');
    const guest = await createAccount(server.baseUrl, 'rejoin_guest');
    const created = await api<RoomSummary>(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: {} });
    const roomId = created.body.roomId;

    const ownerSocket = await track(owner.token);
    const guestSocket = await track(guest.token);
    await emit(ownerSocket, 'room:join', { roomId });
    await emit(guestSocket, 'room:join', { roomId });

    const kicked = nextEvent(guestSocket, 'room:kicked');
    await emit(ownerSocket, 'room:kick', { socketId: guestSocket.id });
    await kicked;

    const joinedAgain = nextEvent(ownerSocket, 'presence:update', (p) => p.event && p.event.type === 'joined');
    const rejoin = await emit(guestSocket, 'room:join', { roomId });
    assert.equal(rejoin.ok, true);
    assert.equal((await joinedAgain).event!.participant.username, guest.username);

    const chat = await emit(guestSocket, 'chat:send', { text: 'back again' });
    assert.equal(chat.ok, true);
  });

  it('rejects removing yourself or someone who is not in the room', async () => {
    const owner = await createAccount(server.baseUrl, 'guard_owner');
    const created = await api<RoomSummary>(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: {} });
    const ownerSocket = await track(owner.token);
    await emit(ownerSocket, 'room:join', { roomId: created.body.roomId });

    const self = await emit(ownerSocket, 'room:kick', { socketId: ownerSocket.id });
    assert.equal(self.code, 'VALIDATION_ERROR');

    const stranger = await createAccount(server.baseUrl, 'guard_stranger');
    const strangerSocket = await track(stranger.token);
    const absent = await emit(ownerSocket, 'room:kick', { socketId: strangerSocket.id });
    assert.equal(absent.code, 'NOT_IN_ROOM');
  });
});
