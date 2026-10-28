import { useEffect, useMemo, type ReactNode } from 'react';
import { getSocket } from '../lib/socket';
import { useAuth } from './authState';
import { SocketContext } from './socketState';

/**
 * Provides the realtime connection for the signed-in session. The socket authenticates with
 * the session token, and a rejected handshake signs the user out.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, logout } = useAuth();
  const socket = useMemo(() => (token ? getSocket(token) : null), [token]);

  useEffect(() => {
    if (!socket) return undefined;

    const onConnectError = (error: Error) => {
      if (error.message === 'UNAUTHORIZED') logout();
    };

    socket.on('connect_error', onConnectError);
    socket.connect();

    return () => {
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, [socket, logout]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
