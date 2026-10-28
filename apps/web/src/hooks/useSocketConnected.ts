import { useCallback, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';

/** Tracks whether the realtime connection is currently open. */
export function useSocketConnected(socket: Socket | null): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!socket) return () => undefined;
      socket.on('connect', onChange);
      socket.on('disconnect', onChange);
      return () => {
        socket.off('connect', onChange);
        socket.off('disconnect', onChange);
      };
    },
    [socket]
  );

  const getSnapshot = useCallback(() => socket?.connected ?? false, [socket]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
