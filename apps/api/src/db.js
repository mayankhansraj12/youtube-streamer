'use strict';

const mongoose = require('mongoose');

const SERVER_SELECTION_TIMEOUT_MS = 10000;

async function connectDatabase(uri) {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

function disconnectDatabase() {
  return mongoose.disconnect();
}

module.exports = { connectDatabase, disconnectDatabase };
