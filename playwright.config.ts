import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: externalBaseUrl ?? 'http://127.0.0.1:3001', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', testIgnore: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', testIgnore: /responsive\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    { name: 'viewport-360', testMatch: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 } } },
    { name: 'viewport-768', testMatch: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'viewport-1280', testMatch: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'viewport-1440', testMatch: /responsive\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: externalBaseUrl ? undefined : { command: 'pnpm dev', url: 'http://127.0.0.1:3001/health', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
