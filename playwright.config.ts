/**
 * Playwright E2E Test Configuration
 *
 * This configuration enables Claude to steer the browser for full E2E testing.
 * Run tests with: pnpm test:e2e
 * Run in headed mode: pnpm test:e2e:headed
 * Debug mode: pnpm test:e2e:debug
 */
import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:4280"

export default defineConfig({
	// Test directory
	testDir: "./e2e",

	// Output directory for test artifacts
	outputDir: "./e2e-results",

	// Run tests in parallel
	fullyParallel: true,

	// Fail the build on CI if you accidentally left test.only in the source code
	forbidOnly: !!process.env.CI,

	// Retry on CI only
	retries: process.env.CI ? 2 : 0,

	// Opt out of parallel tests on CI
	workers: process.env.CI ? 1 : undefined,

	// Reporter to use
	reporter: [
		["html", { outputFolder: "e2e-report", open: "never" }],
		["list"],
	],

	// Shared settings for all the projects below
	use: {
		// Base URL to use in actions like `await page.goto('/')`
		baseURL: BASE_URL,

		// Collect trace when retrying the failed test
		trace: "on-first-retry",

		// Take screenshot on failure
		screenshot: "only-on-failure",

		// Record video on failure
		video: "on-first-retry",

		// Viewport size
		viewport: { width: 1280, height: 720 },

		// Increase timeout for actions (useful when Claude is steering)
		actionTimeout: 30_000,

		// Navigation timeout
		navigationTimeout: 60_000,
	},

	// Global timeout per test
	timeout: 120_000,

	// Expect timeout
	expect: {
		timeout: 10_000,
	},

	// Configure projects for major browsers
	projects: [
		// Default project - Chromium with all features
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				// Enable tracing for debugging
				trace: "retain-on-failure",
			},
		},

		// Firefox for cross-browser testing
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},

		// WebKit for Safari testing
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},

		// Mobile Chrome
		{
			name: "mobile-chrome",
			use: { ...devices["Pixel 5"] },
		},

		// Mobile Safari
		{
			name: "mobile-safari",
			use: { ...devices["iPhone 12"] },
		},
	],

	// Run your local dev server before starting the tests
	webServer: {
		command: "pnpm dev:vite",
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
})
