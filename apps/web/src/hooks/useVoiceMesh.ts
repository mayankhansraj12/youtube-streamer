import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { ICE_SERVERS } from '../config';
import { VoiceMesh } from '../lib/voiceMesh';

interface VoiceMeshInput {
  socket: Socket | null;
  selfId: string | null;
  remoteIds: string[];
  localTrack: MediaStreamTrack | null;
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}

/**
 * Keeps one peer connection per remote participant. The mesh is rebuilt whenever the socket
 * or its identity changes, because the server only relays signals for the current identity.
 */
export function useVoiceMesh({ socket, selfId, remoteIds, localTrack }: VoiceMeshInput) {
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [connectionStates, setConnectionStates] = useState<Record<string, RTCPeerConnectionState>>({});
  const meshRef = useRef<VoiceMesh | null>(null);
  const remoteKey = remoteIds.join(',');

  useEffect(() => {
    if (!socket || !selfId) return undefined;

    const mesh = new VoiceMesh({
      socket,
      selfId,
      iceServers: ICE_SERVERS,
      events: {
        onStream: (remoteId, stream) => setStreams((previous) => ({ ...previous, [remoteId]: stream })),
        onConnectionState: (remoteId, state) =>
          setConnectionStates((previous) => ({ ...previous, [remoteId]: state })),
        onRemoved: (remoteId) => {
          setStreams((previous) => withoutKey(previous, remoteId));
          setConnectionStates((previous) => withoutKey(previous, remoteId));
        },
      },
    });
    meshRef.current = mesh;

    return () => {
      mesh.destroy();
      meshRef.current = null;
    };
  }, [socket, selfId]);

  useEffect(() => {
    meshRef.current?.setLocalTrack(localTrack);
  }, [localTrack, socket, selfId]);

  useEffect(() => {
    meshRef.current?.sync(remoteKey ? remoteKey.split(',') : []);
  }, [remoteKey, socket, selfId]);

  return { streams, connectionStates };
}
