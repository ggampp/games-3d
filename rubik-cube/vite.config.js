import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    entries: ['index.html']
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    target: 'esnext'
  }
});
