import mongoose from 'mongoose';

const SERVER_SELECTION_TIMEOUT_MS = 10000;

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.connection.on('error', (err: Error) => {
    console.error('MongoDB connection error:', err.message);
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export function disconnectDatabase(): Promise<void> {
  return mongoose.disconnect();
}
