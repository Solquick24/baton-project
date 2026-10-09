import { randomBytes, randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';

const environment = {
  NODE_ENV: 'test', API_PORT: '3201', WEB_PORT: '5274',
  JWT_SECRET: randomBytes(32).toString('hex'), SQLITE_PATH: ':memory:',
  UPLOAD_DIR: `/tmp/baton-wireframe-${randomUUID()}`,
  LLM_MODE: 'fixture', STT_MODE: 'fixture', ENABLE_TEST_ENDPOINTS: 'true',
  LIVE_FALLBACK_TO_FIXTURE: 'false', DEMO_TODAY: '2026-03-12',
};
export default defineConfig({
  testDir: './tests/integration', workers: 1, outputDir: '/tmp/baton-wireframe-results',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5274', viewport: { width: 390, height: 844 },
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
  webServer: [
    { command: 'node --import tsx ../../tests/e2e/server.ts', url: 'http://127.0.0.1:3201/api/health', env: environment, reuseExistingServer: false },
    { command: 'npm run dev', url: 'http://127.0.0.1:5274', env: environment, reuseExistingServer: false },
  ],
});
