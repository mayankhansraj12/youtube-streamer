import http from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './database.js';
import { User } from './modules/auth/user.model.js';
import { Room } from './modules/rooms/room.model.js';
import { createSocketServer } from './realtime/socket-server.js';

const SHUTDOWN_TIMEOUT_MS = 10000;

async function start(): Promise<void> {
  const config = loadConfig();

  await connectDatabase(config.mongoUri);
  await Promise.all([User.init(), Room.init()]);

  const app = createApp({ config });
  const server = http.createServer(app);
  const io = await createSocketServer(server, { config });
  app.locals.io = io;

  server.listen(config.port, () => {
    console.log(`StreamSync API listening on port ${config.port} (${config.env})`);
  });

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    io.close(() => {
      disconnectDatabase()
        .catch((err: Error) => console.error('Error while closing MongoDB:', err.message))
        .finally(() => process.exit(0));
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err: Error) => {
  console.error('Failed to start StreamSync API:', err.message);
  process.exit(1);
});
