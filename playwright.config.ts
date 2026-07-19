import { defineConfig } from '@playwright/test';

// E2E runs against a real Chromium with the unpacked extension loaded.
// Build the extension first with `npm run build:e2e` (sets CS_E2E=1).
export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
