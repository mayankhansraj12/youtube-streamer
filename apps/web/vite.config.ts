import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // The hls.js chunk is loaded only when an HLS stream is played, so its size is expected.
    chunkSizeWarningLimit: 650,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
