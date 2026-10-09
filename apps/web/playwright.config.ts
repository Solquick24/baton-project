import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5313', viewport: { width: 390, height: 844 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: { command: 'npm run dev:preview', cwd: '../..', url: 'http://127.0.0.1:5313', reuseExistingServer: false,
    env: { WEB_PORT: '5313', NODE_ENV: 'test', LLM_MODE: 'fixture', STT_MODE: 'fixture', LIVE_FALLBACK_TO_FIXTURE: 'false', OPENAI_API_KEY: '', OPENAI_MODEL: '' } },
});
