import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@streamsync/shared';
import type { Config } from '../config.js';
import { createCorsOriginCheck } from '../lib/origins.js';
import { verifySession } from '../lib/session-token.js';
import { registerRoomHandlers } from './room-protocol.js';
import type { RoomServer, SocketData } from './types.js';

const MAX_SOCKET_PAYLOAD_BYTES = 256 * 1024;

/** Enables cross-instance broadcasting. Startup fails when REDIS_URL is set but unreachable. */
async function attachRedisAdapter(io: RoomServer, redisUrl: string): Promise<void> {
  const { createAdapter } = await import('@socket.io/redis-adapter');
  const { createClient } = await import('redis');

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  for (const client of [pubClient, subClient]) {
    client.on('error', (err: Error) => console.error('Redis error:', err.message));
  }

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Socket.IO Redis adapter connected');
}

export async function createSocketServer(httpServer: HttpServer, { config }: { config: Config }): Promise<RoomServer> {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>(httpServer, {
    cors: {
      origin: createCorsOriginCheck(config.clientOrigins),
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: MAX_SOCKET_PAYLOAD_BYTES,
  });

  if (config.redisUrl) {
    await attachRedisAdapter(io, config.redisUrl);
  }

  // Identity comes from the signed token, never from client-supplied fields.
  io.use((socket, next) => {
    const user = verifySession(socket.handshake.auth?.token, config.jwtSecret);
    if (!user) return next(new Error('UNAUTHORIZED'));

    socket.data.user = user;
    return next();
  });

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket, config);
  });

  return io;
}
