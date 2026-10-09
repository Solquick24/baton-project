import { defineConfig } from '@playwright/test';
const url = `http://127.0.0.1:${process.env.WEB_PORT ?? '5173'}`;
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: { baseURL: url, viewport: { width: 390, height: 844 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: { command: 'npm run dev:preview', cwd: '../..', url, reuseExistingServer: false },
});
