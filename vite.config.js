import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    cors: true,
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
