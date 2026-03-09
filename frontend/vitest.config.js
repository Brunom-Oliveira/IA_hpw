import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.jsx', 'src/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.js'],
  },
});
