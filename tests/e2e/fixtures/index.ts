/**
 * Re-export all E2E test fixtures.
 *
 * Combines PostHog tracking and authentication fixtures into a single test instance.
 */
import { test as basePostHog, type PostHogFixture } from "./base";
import { type AuthFixture } from "./auth";
import { STORAGE_STATE_PATH } from "./storage-state";
import type { Page } from "playwright/test";

export { type CapturedPostHogEvent, type PostHogFixture } from "./base";
export { type AuthFixture } from "./auth";
export { STORAGE_STATE_PATH } from "./storage-state";

/** Setup auth fixture */
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
          "E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables required",
        );
      }

      await page.goto("/login");
      await page.fill('input[name="email"]', testEmail);
      await page.fill('input[name="password"]', testPassword);
      await page.click('button[type="submit"]');

      await page.waitForURL(/\/(projects|login_success|onboarding)/, {
        timeout: 15000,
      });
    },
    async isLoggedIn() {
      return isLoggedIn();
    },
  };
}

/** Combined test fixture with PostHog and Auth */
export const test = basePostHog.extend<{ auth: AuthFixture }>({
  auth: async ({ page }, use) => {
    const fixture = await setupAuth(page);
    await use(fixture);
  },
});

export { expect } from "playwright/test";
