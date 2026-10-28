import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import type { HealthResponse } from '@streamsync/shared';
import type { Config } from './config.js';
import { notFoundHandler, errorHandler } from './http/error-handler.js';
import { createCorsOriginCheck } from './lib/origins.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createRoomsRouter } from './modules/rooms/rooms.routes.js';

const DATABASE_CONNECTED = 1;

export function createApp({ config }: { config: Config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: createCorsOriginCheck(config.clientOrigins) }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/', (_req, res) => {
    res.json({ service: 'streamsync-api', status: 'ok' });
  });

  app.get('/api/health', (_req, res) => {
    const databaseReady = mongoose.connection.readyState === DATABASE_CONNECTED;
    const body: HealthResponse = {
      status: databaseReady ? 'ok' : 'degraded',
      database: databaseReady ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.status(databaseReady ? 200 : 503).json(body);
  });

  app.use('/api/auth', createAuthRouter({ config }));
  app.use('/api/rooms', createRoomsRouter({ config }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
