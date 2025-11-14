import { defineConfig } from 'vite';

export default defineConfig({
  base: '/capability-manifest/',
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  publicDir: 'public'
});
