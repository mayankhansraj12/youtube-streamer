'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { createAuthRouter } = require('./routes/auth');
const { createRoomsRouter } = require('./routes/rooms');
const { createCorsOriginCheck } = require('./lib/origins');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const DATABASE_CONNECTED = 1;

function createApp({ config }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: createCorsOriginCheck(config.clientOrigins) }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/', (req, res) => {
    res.json({ service: 'streamsync-api', status: 'ok' });
  });

  app.get('/api/health', (req, res) => {
    const databaseReady = mongoose.connection.readyState === DATABASE_CONNECTED;
    res.status(databaseReady ? 200 : 503).json({
      status: databaseReady ? 'ok' : 'degraded',
      database: databaseReady ? 'connected' : 'disconnected',
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use('/api/auth', createAuthRouter({ config }));
  app.use('/api/rooms', createRoomsRouter({ config }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
