import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './playwright-e2e',
  testMatch: '**/*.e2e.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: 'line',
  outputDir: resolve(process.env.RUNNER_TEMP || tmpdir(), 'staff-e2e-results'),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
    headless: true,
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
});
