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
    // Probe an authenticated route instead of /login.
    // /login can be slow or noisy during boot and should not be our auth oracle.
    await page.goto("/home");
    await page.waitForLoadState("domcontentloaded");
    return !/\/login(?:$|[?#])/.test(page.url());
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
      // Avoid clicking social auth submit buttons.
      await page.click('button[type="submit"]:has-text("Login")');

      const loginSuccessPattern =
        /\/(projects|login_success|onboarding)(?:\/|$)|\/a\/[^/]+\/[^/]+/;
      const deadline = Date.now() + 15000;
      // App login can route client-side; poll URL instead of relying on a nav event.
      while (Date.now() < deadline) {
        if (loginSuccessPattern.test(page.url())) return;
        await page.waitForTimeout(150);
      }
      throw new Error(`Login did not reach an authenticated route. Final URL: ${page.url()}`);
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
