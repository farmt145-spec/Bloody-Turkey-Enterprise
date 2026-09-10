import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@db': path.resolve(__dirname, './db'),
      '@api': path.resolve(__dirname, './api'),
    },
  },
});
