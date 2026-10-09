import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.API_PORT ?? environment.API_PORT ?? '3001';
  const webPort = Number(process.env.WEB_PORT ?? '5173');
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1', port: webPort, strictPort: true,
      proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } },
    },
    preview: { host: '127.0.0.1' },
  };
});
