import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
    baseURL: 'http://localhost:3456',
  },
  webServer: {
    command: 'node e2e/server.mjs',
    port: 3456,
    reuseExistingServer: !process.env.CI,
  },
});
