import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      LLM_MODE: 'fixture', STT_MODE: 'fixture',
      LIVE_FALLBACK_TO_FIXTURE: 'false',
      SQLITE_PATH: ':memory:',
      JWT_SECRET: 'baton-fixture-test-secret-not-for-real-use',
    },
    restoreMocks: true,
  },
});
