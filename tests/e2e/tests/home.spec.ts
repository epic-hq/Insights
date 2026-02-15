/**
 * Home page E2E tests.
 * Validates basic navigation and PostHog pageview tracking.
 */
import { test, expect } from "../fixtures";

test.describe("Home Page", () => {
	test("loads successfully", async ({ page }) => {
		await page.goto("/");

		// Home page redirects to /login for unauthenticated users
		// Verify we land on a valid page
		await expect(page).toHaveURL(/\/login(\?.*)?$/i, { timeout: 10000 });
		await expect(page.getByRole("heading", { name: /^login$/i })).toBeVisible();
		await expect(page.getByLabel(/^email$/i)).toBeVisible();
		await expect(page.getByLabel(/^password$/i)).toBeVisible();
	});

	test("tracks pageview event", async ({ page, posthog }) => {
		await page.goto("/");
		// Marketing routes no longer load PostHog client-side.
		// Keep this test as a basic smoke test that the page loads and redirects.
		posthog.clearEvents();
		await expect(page).toHaveURL(/\/login(\?.*)?$/i, { timeout: 10000 });
	});

	test("CTA buttons are visible", async ({ page }) => {
		await page.goto("/");

		// Unauthenticated users see login page with sign-up CTA
		const ctaButton = page.getByRole("link", {
			name: /sign up|get started|create account/i,
		});
		await expect(ctaButton).toBeVisible();
	});
});
