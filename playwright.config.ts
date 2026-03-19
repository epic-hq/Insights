import { defineConfig, devices } from "playwright/test";

const e2eBaseURL = process.env.E2E_BASE_URL || "http://localhost:4290";

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
  reporter: [
    ["json", { outputFile: "test-results/report.json" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["html", { open: "never" }],
    ["list"],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL: e2eBaseURL,
    trace:
      process.env.E2E_TRACE === "on"
        ? "on"
        : process.env.CI
          ? "on-first-retry"
          : "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    storageState:
      process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD
        ? "tests/e2e/.auth/user.json"
        : undefined,
  },

  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      retries: 1,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: "smoke.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: "smoke.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: "smoke.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  /* Run local dev server before starting the tests (skip when E2E_BASE_URL or CI is set) */
  webServer:
    process.env.CI || process.env.E2E_BASE_URL
      ? undefined
      : {
          command:
            "mkdir -p build/client && PORT=4290 PLAYWRIGHT=1 dotenvx run -- react-router dev",
          url: e2eBaseURL,
          reuseExistingServer: false,
          timeout: 240 * 1000,
        },
});
