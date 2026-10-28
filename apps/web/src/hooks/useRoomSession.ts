import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSocket } from '../lib/socket';
import { LIMITS } from '../config';
import { estimateClockOffset } from '../lib/playbackClock';
import { request, SocketRequestError } from '../lib/socket';
import type { ChatItem, ChatMessage, Participant, PlaybackState, PresenceUpdate } from '../types';
import { useLatest } from './useLatest';

const MAX_CHAT_ITEMS = 300;

export interface RoomIdentity {
  roomId: string;
  name: string;
  owner: string;
  ownerId: string;
}

export interface RoomSessionOptions {
  socket: RoomSocket | null;
  roomId: string;
  onRoomEnded: (reason: string) => void;
  onKicked: () => void;
  onJoinFailed: (error: SocketRequestError) => void;
  onActionError: (message: string) => void;
}

function toChatItem(message: ChatMessage): ChatItem {
  return { kind: 'message', ...message };
}

function appendItem(items: ChatItem[], item: ChatItem): ChatItem[] {
  const next = [...items, item];
  return next.length > MAX_CHAT_ITEMS ? next.slice(next.length - MAX_CHAT_ITEMS) : next;
}

const OFFLINE_ERROR = () => new SocketRequestError('OFFLINE', 'You are offline. Reconnecting…');

/**
 * Connects this browser to one room on the server: joins on every (re)connect, keeps presence,
 * chat, and playback state current, and exposes the actions the room page needs.
 */
export function useRoomSession({
  socket,
  roomId,
  onRoomEnded,
  onKicked,
  onJoinFailed,
  onActionError,
}: RoomSessionOptions) {
  const [room, setRoom] = useState<RoomIdentity | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [joined, setJoined] = useState(false);
  const offsetRef = useRef(0);
  const endedRef = useLatest(onRoomEnded);
  const kickedRef = useLatest(onKicked);
  const joinFailedRef = useLatest(onJoinFailed);
  const actionErrorRef = useLatest(onActionError);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  useEffect(() => {
    if (!socket) return undefined;
    let active = true;

    const join = async () => {
      const sentAt = Date.now();
      try {
        const reply = await request(socket, 'room:join', { roomId, muted: true });
        if (!active) return;

        const { snapshot } = reply;
        offsetRef.current = estimateClockOffset(snapshot.serverTime, sentAt, Date.now());
        setSelfId(reply.selfId);
        setRoom({ roomId: snapshot.roomId, name: snapshot.name, owner: snapshot.owner, ownerId: snapshot.ownerId });
        setParticipants(snapshot.participants);
        setItems(snapshot.messages.map(toChatItem));
        setPlayback(snapshot.playback);
        setJoined(true);
      } catch (error) {
        if (!active) return;
        setJoined(false);
        joinFailedRef.current(
          error instanceof SocketRequestError ? error : new SocketRequestError('UNKNOWN', 'Could not join the room.')
        );
      }
    };

    const handlePresence = (update: PresenceUpdate) => {
      setParticipants(update.participants);
      if (!update.event) return;

      const { type, participant } = update.event;
      const now = Date.now();
      setItems((previous) =>
        appendItem(previous, {
          kind: 'system',
          id: `${type}-${participant.socketId}-${now}`,
          text: `${participant.username} ${type === 'joined' ? 'joined the room' : 'left the room'}`,
          createdAt: now,
        })
      );
    };
    const handleMessage = (message: ChatMessage) => setItems((previous) => appendItem(previous, toChatItem(message)));
    const handlePlaybackState = (state: PlaybackState) => setPlayback(state);
    const handleRoomEnded = (payload: { reason?: string }) => endedRef.current(payload?.reason ?? 'ended');
    const handleKicked = () => kickedRef.current();

    socket.on('connect', join);
    socket.on('presence:update', handlePresence);
    socket.on('chat:message', handleMessage);
    socket.on('playback:state', handlePlaybackState);
    socket.on('room:ended', handleRoomEnded);
    socket.on('room:kicked', handleKicked);
    if (socket.connected) void join();

    return () => {
      active = false;
      socket.off('connect', join);
      socket.off('presence:update', handlePresence);
      socket.off('chat:message', handleMessage);
      socket.off('playback:state', handlePlaybackState);
      socket.off('room:ended', handleRoomEnded);
      socket.off('room:kicked', handleKicked);
      // Leaving on unmount is fire-and-forget, so the acknowledgement is ignored.
      if (socket.connected) socket.emit('room:leave', () => undefined);
    };
  }, [socket, roomId, endedRef, kickedRef, joinFailedRef]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!socket?.connected) throw OFFLINE_ERROR();
      await request(socket, 'chat:send', { text: text.slice(0, LIMITS.maxMessageLength) });
    },
    [socket]
  );

  const setMuted = useCallback(
    (muted: boolean) => {
      if (!socket?.connected) return;
      request(socket, 'room:mute', { muted }).catch(() => undefined);
    },
    [socket]
  );

  const loadSource = useCallback(
    async (url: string) => {
      if (!socket?.connected) throw OFFLINE_ERROR();
      const reply = await request(socket, 'playback:set-source', { url });
      setPlayback(reply.playback);
    },
    [socket]
  );

  const control = useCallback(
    (playing: boolean, position: number) => {
      if (!socket?.connected) return;
      setPlayback((previous) => (previous ? { ...previous, playing, position, updatedAt: serverNow() } : previous));
      request(socket, 'playback:control', { playing, position })
        .then((reply) => setPlayback(reply.playback))
        .catch((error: unknown) => {
          actionErrorRef.current(error instanceof Error ? error.message : 'Playback could not be updated.');
        });
    },
    [socket, serverNow, actionErrorRef]
  );

  const kick = useCallback(
    async (targetSocketId: string) => {
      if (!socket?.connected) throw OFFLINE_ERROR();
      await request(socket, 'room:kick', { socketId: targetSocketId });
    },
    [socket]
  );

  const leave = useCallback(async () => {
    if (!socket?.connected) return;
    await request(socket, 'room:leave').catch(() => undefined);
  }, [socket]);

  return {
    room,
    selfId,
    participants,
    items,
    playback,
    joined,
    serverNow,
    sendMessage,
    setMuted,
    loadSource,
    control,
    kick,
    leave,
  };
}
