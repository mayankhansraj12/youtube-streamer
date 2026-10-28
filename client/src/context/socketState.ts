import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';

export const SocketContext = createContext<Socket | null>(null);

export function useSocket(): Socket | null {
  return useContext(SocketContext);
}
