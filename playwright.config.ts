import { defineConfig, devices } from '@playwright/test';

const useDist = !!process.env.TEST_DIST;
// In CI the dist/ folder is already populated from a separate build job's
// uploaded artifact, so we skip the rebuild and just serve it.
const skipBuild = !!process.env.TEST_DIST_SKIP_BUILD;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Locally Playwright defaults to (CPU/2) workers which can starve the
  // requestAnimationFrame loop of 16 parallel WebGL pages — projectile
  // collision specs become flaky. Cap at 4 outside CI.
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: useDist
      ? (skipBuild ? 'npm run serve:dist' : 'npm run build && npm run serve:dist')
      : 'npm run serve',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
