import { defineConfig, devices } from "playwright/test";

/**
 * Playwright E2E test configuration for UpSight.
 *
 * Run E2E tests with: pnpm test:e2e
 * Run with UI:        pnpm test:e2e:ui
 * Run headed:         pnpm test:e2e:headed
 *
 * Tests are designed to validate:
 * - PostHog tracking events fire correctly
 * - Critical user flows work end-to-end
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:4280",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  /* Run local dev server before starting the tests if not in CI */
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm run dev:vite",
        url: "http://localhost:4280",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },
});
