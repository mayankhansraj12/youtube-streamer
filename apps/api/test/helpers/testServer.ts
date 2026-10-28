'use strict';

const http = require('node:http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { loadConfig } = require('../../src/config');
const { connectDatabase, disconnectDatabase } = require('../../src/db');
const { createApp } = require('../../src/app');
const { createSocketServer } = require('../../src/socket');
const User = require('../../src/models/User');
const Room = require('../../src/models/Room');

/**
 * Boots the real API and Socket.IO server on a random port. Uses an in-memory MongoDB
 * unless MONGODB_URI_TEST is set, in which case that database is used and left intact.
 */
async function startTestServer({ maxRoomParticipants = 12 } = {}) {
  const external = Boolean(process.env.MONGODB_URI_TEST);
  const mongod = external ? null : await MongoMemoryServer.create();
  const mongoUri = external ? process.env.MONGODB_URI_TEST : mongod.getUri('streamsync_test');

  const config = loadConfig({
    MONGODB_URI: mongoUri,
    JWT_SECRET: 'integration-test-secret-0123456789',
    CLIENT_ORIGIN: 'http://localhost:5173',
    AUTH_RATE_LIMIT: '1000',
    MAX_ROOM_PARTICIPANTS: String(maxRoomParticipants),
  });

  await connectDatabase(config.mongoUri);
  if (!external) await mongoose.connection.db.dropDatabase();
  await Promise.all([User.init(), Room.init()]);

  const expressApp = createApp({ config });
  const httpServer = http.createServer(expressApp);
  const io = await createSocketServer(httpServer, { config });
  expressApp.locals.io = io;

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise((resolve) => io.close(() => resolve()));
      await disconnectDatabase();
      if (mongod) await mongod.stop();
    },
  };
}

module.exports = { startTestServer };
