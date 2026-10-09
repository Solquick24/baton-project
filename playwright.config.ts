import { randomBytes } from 'node:crypto';
import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Separate ports/data prevent tests from reusing a live-mode development server.
const environment = {
  NODE_ENV: 'test',
  API_PORT: '3314', WEB_PORT: '5314',
  JWT_SECRET: randomBytes(32).toString('hex'),
  LLM_MODE: 'fixture', STT_MODE: 'fixture', LIVE_FALLBACK_TO_FIXTURE: 'false', DEMO_TODAY: '2026-03-12',
  SQLITE_PATH: ':memory:', UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'baton-e2e-')),
  OPENAI_API_KEY: '', OPENAI_MODEL: '',
  ENABLE_TEST_ENDPOINTS: 'true',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL: 'http://127.0.0.1:5314', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    { command: 'node --import tsx tests/e2e/server.ts', url: 'http://127.0.0.1:3314/api/health', reuseExistingServer: false, timeout: 30_000, env: environment },
    { command: 'npm run dev --workspace @baton/web', url: 'http://127.0.0.1:5314', reuseExistingServer: false, timeout: 30_000, env: environment },
  ],
});
