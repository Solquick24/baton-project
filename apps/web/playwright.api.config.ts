import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-api', workers: 1, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5183', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {} },
  webServer: {
    command: 'npm run dev --workspace @baton/web', cwd: '../..',
    url: 'http://127.0.0.1:5183', reuseExistingServer: false,
    env: { WEB_PORT: '5183', API_PORT: '3103' },
  },
});
