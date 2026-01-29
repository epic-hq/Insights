/**
 * Authentication fixtures for E2E tests.
 *
 * Provides test utilities for authenticated user flows.
 * Uses test credentials from environment variables.
 */
import { test as base, type Page } from "playwright/test";
import * as path from "node:path";

const STORAGE_STATE_PATH = path.join(__dirname, "..", ".auth", "user.json");

export interface AuthFixture {
  login: (email?: string, password?: string) => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
}

/**
 * Creates an auth fixture for handling login flows.
 */
async function setupAuth(page: Page): Promise<AuthFixture> {
  return {
    async login(email?: string, password?: string) {
      const testEmail = email || process.env.E2E_TEST_EMAIL;
      const testPassword = password || process.env.E2E_TEST_PASSWORD;

      if (!testEmail || !testPassword) {
        throw new Error(
          "E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables required for authenticated tests",
        );
      }

      await page.goto("/login");
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');

      // Wait for successful redirect
      await page.waitForURL(/\/(projects|login_success|onboarding)/, {
        timeout: 15000,
      });
    },
    async isLoggedIn() {
      // Check for authenticated user indicators
      const cookies = await page.context().cookies();
      const hasAuthCookie = cookies.some(
        (c) => c.name.includes("supabase") || c.name.includes("auth"),
      );
      return hasAuthCookie;
    },
  };
}

/** Test with auth fixture */
export const test = base.extend<{ auth: AuthFixture }>({
  auth: async ({ page }, use) => {
    const fixture = await setupAuth(page);
    await use(fixture);
  },
});

export { expect } from "playwright/test";
export { STORAGE_STATE_PATH };
