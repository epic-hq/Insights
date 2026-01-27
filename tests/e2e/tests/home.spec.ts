/**
 * Home page E2E tests.
 * Validates basic navigation and PostHog pageview tracking.
 */
import { test, expect } from "../fixtures";

test.describe("Home Page", () => {
  test("loads successfully", async ({ page }) => {
    await page.goto("/");

    // Verify page loaded
    await expect(page).toHaveTitle(/UpSight|Insights/i);
  });

  test("tracks pageview event", async ({ page, posthog }) => {
    await page.goto("/");

    // Wait for PostHog pageview
    const pageviewEvent = await posthog.waitForEvent("$pageview");

    expect(pageviewEvent).toBeDefined();
    expect(pageviewEvent.properties).toHaveProperty("$current_url");
  });

  test("CTA buttons are visible", async ({ page }) => {
    await page.goto("/");

    // Check for main CTA buttons
    const getStartedButton = page.getByRole("link", { name: /get started/i });
    await expect(getStartedButton).toBeVisible();
  });
});
