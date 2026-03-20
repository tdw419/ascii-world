import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  resolve: {
    alias: {
      '@renderer': '/src/renderer',
    },
  },
});
