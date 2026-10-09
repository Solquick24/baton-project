import { randomBytes } from 'node:crypto';
import { defineConfig } from '@playwright/test';

// Separate ports/data prevent tests from reusing a live-mode development server.
const apiPort = process.env.E2E_API_PORT ?? '3101';
const webPort = process.env.E2E_WEB_PORT ?? '5174';
const environment = {
  NODE_ENV: 'test',
  API_PORT: apiPort, WEB_PORT: webPort,
  JWT_SECRET: randomBytes(32).toString('hex'),
  LLM_MODE: 'fixture', STT_MODE: 'fixture', LIVE_FALLBACK_TO_FIXTURE: 'false', DEMO_TODAY: '2026-03-12',
  SQLITE_PATH: ':memory:', UPLOAD_DIR: './data/e2e/uploads',
  ENABLE_TEST_ENDPOINTS: 'true',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL: `http://127.0.0.1:${webPort}`, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    { command: 'npx tsx tests/e2e/server.ts', url: `http://127.0.0.1:${apiPort}/api/health`, reuseExistingServer: false, timeout: 30_000, env: environment },
    { command: 'npm run dev --workspace @baton/web', url: `http://127.0.0.1:${webPort}`, reuseExistingServer: false, timeout: 30_000, env: environment },
  ],
});
