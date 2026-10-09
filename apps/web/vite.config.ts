import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { previewApi } from './dev/preview-api.ts';
import { demoAccounts } from './dev/demo-accounts.ts';

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  const apiPort = process.env.API_PORT ?? environment.API_PORT ?? '3001';
  const webPort = Number(process.env.WEB_PORT ?? '5173');
  return {
    plugins: [react(), ...(command === 'serve' ? [demoAccounts()] : []), ...(command === 'serve' && mode === 'preview' ? [previewApi()] : [])],
    server: {
      host: '127.0.0.1', port: webPort, strictPort: true,
      ...(mode !== 'preview' ? { proxy: { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } } } : {}),
      fs: { deny: ['**/.env*', '**/.git/**', '**/fixtures/**', '**/.aws/**', '**/.codex/**'] },
    },
    preview: { host: '127.0.0.1' },
  };
});
