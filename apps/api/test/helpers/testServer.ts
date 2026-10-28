import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { loadConfig } from '../../src/config.js';
import { connectDatabase, disconnectDatabase } from '../../src/database.js';
import { createApp } from '../../src/app.js';
import { createSocketServer } from '../../src/realtime/socket-server.js';
import { User } from '../../src/modules/auth/user.model.js';
import { Room } from '../../src/modules/rooms/room.model.js';

export interface TestServer {
  baseUrl: string;
  stop: () => Promise<void>;
}

/**
 * Boots the real API and Socket.IO server on a random port. Uses an in-memory MongoDB
 * unless MONGODB_URI_TEST is set, in which case that database is used and left intact.
 */
export async function startTestServer({
  maxRoomParticipants = 12,
}: { maxRoomParticipants?: number } = {}): Promise<TestServer> {
  const external = Boolean(process.env.MONGODB_URI_TEST);
  const mongod = external ? null : await MongoMemoryServer.create();
  const mongoUri = external ? process.env.MONGODB_URI_TEST : mongod?.getUri('streamsync_test');

  const config = loadConfig({
    MONGODB_URI: mongoUri,
    JWT_SECRET: 'integration-test-secret-0123456789',
    CLIENT_ORIGIN: 'http://localhost:5173',
    AUTH_RATE_LIMIT: '1000',
    MAX_ROOM_PARTICIPANTS: String(maxRoomParticipants),
  });

  await connectDatabase(config.mongoUri);
  if (!external) await mongoose.connection.db!.dropDatabase();
  await Promise.all([User.init(), Room.init()]);

  const expressApp = createApp({ config });
  const httpServer = http.createServer(expressApp);
  const io = await createSocketServer(httpServer, { config });
  expressApp.locals.io = io;

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('test server is not listening on a TCP port');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    stop: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await disconnectDatabase();
      if (mongod) await mongod.stop();
    },
  };
}
