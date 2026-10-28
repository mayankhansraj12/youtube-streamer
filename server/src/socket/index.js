'use strict';

const { Server } = require('socket.io');
const { verifySession } = require('../lib/auth');
const { createCorsOriginCheck } = require('../lib/origins');
const { registerRoomHandlers } = require('./roomHandlers');

const MAX_SOCKET_PAYLOAD_BYTES = 256 * 1024;

/** Enables cross-instance broadcasting. Startup fails when REDIS_URL is set but unreachable. */
async function attachRedisAdapter(io, redisUrl) {
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { createClient } = require('redis');

  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  for (const client of [pubClient, subClient]) {
    client.on('error', (err) => console.error('Redis error:', err.message));
  }

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log('Socket.IO Redis adapter connected');
}

async function createSocketServer(httpServer, { config }) {
  const io = new Server(httpServer, {
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
    const user = verifySession(socket.handshake.auth && socket.handshake.auth.token, config.jwtSecret);
    if (!user) return next(new Error('UNAUTHORIZED'));

    socket.data.user = user;
    return next();
  });

  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket, config);
  });

  return io;
}

module.exports = { createSocketServer };
