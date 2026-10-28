import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { MediaSource, RoomSummary } from '@streamsync/shared';
import { startTestServer, type TestServer } from '../helpers/testServer.js';
import {
  api,
  createAccount,
  connectSocket,
  emit,
  nextEvent,
  type Account,
  type ConnectedSocket,
  type ReplyOf,
} from '../helpers/client.js';

type YouTubeSource = Extract<MediaSource, { kind: 'youtube' }>;

describe('realtime room protocol', () => {
  let server: TestServer;
  const sockets: ConnectedSocket[] = [];
  const track = async (token: string): Promise<ConnectedSocket> => {
    const socket = await connectSocket(server.baseUrl, token);
    sockets.push(socket);
    return socket;
  };
  const createRoom = async (owner: Account, name = 'Realtime room'): Promise<RoomSummary> => {
    const res = await api<RoomSummary>(server.baseUrl, 'POST', '/api/rooms', { token: owner.token, body: { name } });
    assert.equal(res.status, 201);
    return res.body;
  };

  before(async () => {
    server = await startTestServer();
  });

  after(async () => {
    sockets.forEach((socket) => socket.close());
    await server.stop();
  });

  it('refuses socket connections without a valid session token', async () => {
    await assert.rejects(connectSocket(server.baseUrl, undefined), (err: Error) => err.message === 'UNAUTHORIZED');
    await assert.rejects(connectSocket(server.baseUrl, 'not-a-jwt'), (err: Error) => err.message === 'UNAUTHORIZED');
  });

  it('synchronises presence, chat, playback and mute state across participants', async () => {
    const host = await createAccount(server.baseUrl, 'host');
    const guest = await createAccount(server.baseUrl, 'guest');
    const late = await createAccount(server.baseUrl, 'late');
    const room = await createRoom(host, 'Sync room');

    const hostSocket = await track(host.token);
    const guestSocket = await track(guest.token);

    const hostJoin = await emit(hostSocket, 'room:join', { roomId: room.roomId, muted: false });
    assert.equal(hostJoin.ok, true);
    assert.equal(hostJoin.selfId, hostSocket.id);
    assert.equal(hostJoin.snapshot.name, 'Sync room');
    assert.equal(hostJoin.snapshot.ownerId, host.id);
    assert.equal(hostJoin.snapshot.participants.length, 1);
    assert.equal(hostJoin.snapshot.participants[0].muted, false);

    const hostSeesGuest = nextEvent(hostSocket, 'presence:update', (p) => p.event && p.event.type === 'joined');
    const guestJoin = await emit(guestSocket, 'room:join', { roomId: room.roomId.toUpperCase() });
    assert.equal(guestJoin.ok, true);

    const joinEvent = await hostSeesGuest;
    assert.equal(joinEvent.event!.participant.username, guest.username);
    assert.equal(joinEvent.participants.length, 2);
    const guestEntry = guestJoin.snapshot.participants.find((p) => p.socketId === guestSocket.id);
    assert.equal(guestEntry!.muted, true, 'participants join muted unless they say otherwise');

    const chatAtGuest = nextEvent(guestSocket, 'chat:message');
    const sent = await emit(hostSocket, 'chat:send', { text: '  hello there\u0007  ' });
    assert.equal(sent.ok, true);
    const received = await chatAtGuest;
    assert.equal(received.username, host.username);
    assert.equal(received.text, 'hello there');

    const stateAtGuest = nextEvent(guestSocket, 'playback:state');
    const loaded = await emit(hostSocket, 'playback:set-source', { url: 'https://youtu.be/dQw4w9WgXcQ?t=30' });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.playback.source!.kind, 'youtube');
    assert.equal(loaded.playback.source!.youtubeId, 'dQw4w9WgXcQ');
    assert.equal(loaded.playback.position, 30);
    assert.equal((await stateAtGuest).playing, true);

    const pausedAtGuest = nextEvent(guestSocket, 'playback:state', (p) => p.playing === false);
    const paused = await emit(guestSocket, 'playback:control', { playing: false, position: 42.5 });
    assert.equal(paused.ok, true);
    assert.equal((await pausedAtGuest).position, 42.5);

    const lateSocket = await track(late.token);
    const lateJoin = await emit(lateSocket, 'room:join', { roomId: room.roomId, muted: true });
    // The ok check narrows the reply to its snapshot. The cast records that the source is the YouTube link loaded above.
    assert.equal(lateJoin.ok, true);
    assert.equal((lateJoin.snapshot.playback.source as YouTubeSource).youtubeId, 'dQw4w9WgXcQ');
    assert.equal(lateJoin.snapshot.playback.playing, false);
    assert.equal(lateJoin.snapshot.playback.position, 42.5);
    assert.equal(lateJoin.snapshot.messages.at(-1)!.text, 'hello there');
    assert.equal(lateJoin.snapshot.participants.length, 3);

    const guestUnmuted = nextEvent(hostSocket, 'presence:update', (p) =>
      p.participants.some((participant) => participant.socketId === guestSocket.id && participant.muted === false)
    );
    const muted = await emit(guestSocket, 'room:mute', { muted: false });
    assert.equal(muted.ok, true);
    await guestUnmuted;
  });

  it('rejects room actions from sockets that have not joined a room', async () => {
    const outsider = await createAccount(server.baseUrl, 'outsider');
    const socket = await track(outsider.token);

    const chat = await emit(socket, 'chat:send', { text: 'hello?' });
    assert.equal(chat.ok, false);
    assert.equal(chat.code, 'NOT_IN_ROOM');

    const control = await emit(socket, 'playback:control', { playing: true, position: 1 });
    assert.equal(control.code, 'NOT_IN_ROOM');

    const join = await emit(socket, 'room:join', { roomId: 'nosuchroom' });
    assert.equal(join.ok, false);
    assert.equal(join.code, 'ROOM_NOT_FOUND');
  });

  it('validates payloads and returns descriptive errors', async () => {
    const host = await createAccount(server.baseUrl, 'validator');
    const room = await createRoom(host);
    const socket = await track(host.token);
    await emit(socket, 'room:join', { roomId: room.roomId });

    const empty = await emit(socket, 'chat:send', { text: '   ' });
    assert.equal(empty.code, 'VALIDATION_ERROR');

    const invalidSource = await emit(socket, 'playback:set-source', { url: 'javascript:alert(1)' });
    assert.equal(invalidSource.code, 'INVALID_SOURCE');

    const noMedia = await emit(socket, 'playback:control', { playing: true, position: 5 });
    assert.equal(noMedia.code, 'NO_MEDIA');

    await emit(socket, 'playback:set-source', { url: 'https://cdn.example.com/clip.mp4' });
    const badPosition = await emit(socket, 'playback:control', { playing: true, position: -4 });
    assert.equal(badPosition.code, 'VALIDATION_ERROR');
  });

  it('rate-limits chat bursts instead of letting one socket flood the room', async () => {
    const host = await createAccount(server.baseUrl, 'spammer');
    const room = await createRoom(host);
    const socket = await track(host.token);
    await emit(socket, 'room:join', { roomId: room.roomId });

    const replies: ReplyOf<'chat:send'>[] = [];
    for (let i = 0; i < 8; i += 1) {
      replies.push(await emit(socket, 'chat:send', { text: `message ${i}` }));
    }

    assert.ok(replies.some((reply) => reply.code === 'RATE_LIMITED'), 'a burst beyond the bucket must be refused');
    assert.equal(replies[0].ok, true);
  });

  it('relays WebRTC signals only between sockets that share a room', async () => {
    const host = await createAccount(server.baseUrl, 'signaller');
    const peer = await createAccount(server.baseUrl, 'peer');
    const outsider = await createAccount(server.baseUrl, 'bystander');
    const room = await createRoom(host);

    const hostSocket = await track(host.token);
    const peerSocket = await track(peer.token);
    const outsiderSocket = await track(outsider.token);
    await emit(hostSocket, 'room:join', { roomId: room.roomId });
    await emit(peerSocket, 'room:join', { roomId: room.roomId });

    let leaked = false;
    outsiderSocket.on('rtc:signal', () => {
      leaked = true;
    });

    const offer = nextEvent(peerSocket, 'rtc:signal');
    hostSocket.emit('rtc:signal', { to: peerSocket.id, description: { type: 'offer', sdp: 'v=0' } });
    const relayed = await offer;
    assert.equal(relayed.from, hostSocket.id);
    assert.equal(relayed.description!.type, 'offer');

    hostSocket.emit('rtc:signal', { to: outsiderSocket.id, description: { type: 'offer', sdp: 'v=0' } });
    const candidateAtPeer = nextEvent(peerSocket, 'rtc:signal');
    hostSocket.emit('rtc:signal', {
      to: peerSocket.id,
      candidate: { candidate: 'candidate:1 1 udp 1 127.0.0.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 },
    });
    await candidateAtPeer;

    assert.equal(leaked, false, 'signals must never reach sockets outside the room');
  });

  it('removes participants from presence when their socket disconnects', async () => {
    const host = await createAccount(server.baseUrl, 'stayer');
    const guest = await createAccount(server.baseUrl, 'leaver');
    const room = await createRoom(host);

    const hostSocket = await track(host.token);
    const guestSocket = await track(guest.token);
    await emit(hostSocket, 'room:join', { roomId: room.roomId });
    await emit(guestSocket, 'room:join', { roomId: room.roomId });

    const left = nextEvent(hostSocket, 'presence:update', (p) => p.event && p.event.type === 'left');
    guestSocket.close();

    const payload = await left;
    assert.equal(payload.event!.participant.username, guest.username);
    assert.equal(payload.participants.length, 1);
  });
});
