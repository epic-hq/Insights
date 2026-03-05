/**
 * Post-deploy smoke tests for staging environment.
 *
 * Fast, reliable checks (~60s) that verify a deployment is functional.
 * Run with: E2E_BASE_URL=https://upsight-staging.fly.dev pnpm test:e2e:smoke
 */
import { test, expect } from "../fixtures";

const STAGING_TIMEOUT = 15_000; // generous for Fly cold starts

test.describe("Health", () => {
  test("healthcheck returns 200", async ({ request }) => {
    const response = await request.get("/healthcheck", {
      timeout: STAGING_TIMEOUT,
    });
    expect(response.ok()).toBeTruthy();
  });
});

test.describe("Public Pages", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login", { timeout: STAGING_TIMEOUT });
    await expect(page.getByRole("button", { name: /login/i })).toBeVisible({
      timeout: STAGING_TIMEOUT,
    });
  });

  test("sign-up page loads", async ({ page }) => {
    await page.goto("/sign-up", { timeout: STAGING_TIMEOUT });
    await expect(page.getByLabel(/email/i)).toBeVisible({
      timeout: STAGING_TIMEOUT,
    });
  });
});

test.describe("Auth Redirect", () => {
  test("unauthenticated visit to protected route redirects to login", async ({
    browser,
  }) => {
    // Use a fresh context with no stored auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/projects", { timeout: STAGING_TIMEOUT });
    await page.waitForURL(/\/login/, { timeout: STAGING_TIMEOUT });
    expect(page.url()).toContain("/login");

    await context.close();
  });
});

test.describe("Authenticated", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - E2E_TEST_EMAIL/PASSWORD not set",
  );

  test("can login and reach app", async ({ page, auth }) => {
    await auth.login();
    expect(page.url()).toMatch(/\/(projects|onboarding|a\/)/);
  });

  test("app shell renders navigation", async ({ page, auth }) => {
    await auth.login();

    // Wait for sidebar/nav to appear (indicates app shell loaded)
    const nav = page.locator("nav, [data-sidebar], aside");
    await expect(nav.first()).toBeVisible({ timeout: STAGING_TIMEOUT });
  });

  test("no critical JS errors on authenticated page", async ({
    page,
    auth,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      // Ignore non-critical errors (PostHog, analytics, extensions)
      const msg = error.message.toLowerCase();
      if (
        msg.includes("posthog") ||
        msg.includes("analytics") ||
        msg.includes("extension") ||
        msg.includes("recaptcha")
      )
        return;
      errors.push(error.message);
    });

    await auth.login();

    // Give the page time to fully hydrate
    await page.waitForTimeout(3000);

    expect(errors).toEqual([]);
  });
});
