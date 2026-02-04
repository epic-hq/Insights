/**
 * Authentication fixtures for E2E tests.
 *
 * Provides test utilities for authenticated user flows.
 * Uses test credentials from environment variables.
 */
import { test as base, type Page } from "playwright/test";
import { STORAGE_STATE_PATH } from "./storage-state";

export interface AuthFixture {
  login: (email?: string, password?: string) => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
}

/**
 * Creates an auth fixture for handling login flows.
 */
async function setupAuth(page: Page): Promise<AuthFixture> {
  const isLoggedIn = async () => {
    const cookies = await page.context().cookies();
    return cookies.some(
      (c) => c.name.includes("supabase") || c.name.includes("auth"),
    );
  };

  return {
    async login(email?: string, password?: string) {
      if (await isLoggedIn()) return;

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
      // Click the Login button (not the Google OAuth button which is also type="submit")
      await page.click('button[type="submit"]:has-text("Login")');

      // Wait for successful redirect
      await page.waitForURL(/\/(projects|login_success|onboarding|a\/)/, {
        timeout: 15000,
      });
    },
    async isLoggedIn() {
      return isLoggedIn();
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
