import { randomBytes, randomUUID } from 'node:crypto';
import { defineConfig } from '@playwright/test';

const environment = {
  NODE_ENV: 'test', API_PORT: '3381', WEB_PORT: '5485',
  JWT_SECRET: randomBytes(32).toString('hex'), SQLITE_PATH: ':memory:',
  UPLOAD_DIR: `/tmp/baton-brand-${randomUUID()}`,
  LLM_MODE: 'fixture', STT_MODE: 'fixture', ENABLE_TEST_ENDPOINTS: 'true',
  LIVE_FALLBACK_TO_FIXTURE: 'false', DEMO_TODAY: '2026-03-12',
};
export default defineConfig({
  testDir: './tests/integration', testMatch: '**/brand.spec.ts', workers: 1,
  outputDir: '/tmp/baton-brand-results-45', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5485', viewport: { width: 390, height: 844 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: [
    { command: 'node --import tsx ../../tests/e2e/server.ts', url: 'http://127.0.0.1:3381/api/health', env: environment, reuseExistingServer: false },
    { command: 'npm run dev', url: 'http://127.0.0.1:5485', env: environment, reuseExistingServer: false },
  ],
});
