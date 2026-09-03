import { defineConfig } from 'vite';
import { scanTwoShotPlugin } from './vite.scan-plugin.js';

export default defineConfig({
  plugins: [scanTwoShotPlugin()],
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
