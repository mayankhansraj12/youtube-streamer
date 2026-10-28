import { createContext, useContext } from 'react';
import type { RoomSocket } from '../lib/socket';

export const SocketContext = createContext<RoomSocket | null>(null);

export function useSocket(): RoomSocket | null {
  return useContext(SocketContext);
}
