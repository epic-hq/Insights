/**
 * Smoke Tests
 *
 * Basic smoke tests to verify the app is running and key pages load.
 * These tests run quickly and verify core functionality.
 */
import { test, expect } from "../fixtures/base.fixture"

test.describe("Smoke Tests", () => {
	test("homepage loads successfully", async ({ page, helpers }) => {
		await page.goto("/")
		await helpers.waitForPageLoad()

		// Should either show login or redirect to dashboard
		const url = page.url()
		expect(url).toMatch(/\/(login|a\/|home|welcome)/)
	})

	test("login page renders correctly", async ({ page, helpers }) => {
		await page.goto("/login")
		await helpers.waitForPageLoad()

		// Check for login form elements
		const emailInput = page.getByLabel(/email/i)
		const passwordInput = page.getByLabel(/password/i)

		await expect(emailInput).toBeVisible()
		await expect(passwordInput).toBeVisible()
	})

	test("sign up page renders correctly", async ({ page, helpers }) => {
		await page.goto("/sign-up")
		await helpers.waitForPageLoad()

		// Page should load without errors
		const url = page.url()
		expect(url).toContain("sign-up")
	})

	test("healthcheck endpoint returns OK", async ({ page }) => {
		const response = await page.goto("/healthcheck")
		expect(response?.status()).toBe(200)
	})

	test("404 page renders for unknown routes", async ({ page, helpers }) => {
		await page.goto("/this-route-definitely-does-not-exist-12345")
		await helpers.waitForPageLoad()

		// Should show some kind of not found content
		const pageText = await helpers.getPageText()
		expect(pageText.toLowerCase()).toMatch(/not found|404|page.*not.*exist/i)
	})
})

test.describe("Navigation Tests", () => {
	test("can navigate between auth pages", async ({ page, helpers }) => {
		// Start at login
		await page.goto("/login")
		await helpers.waitForPageLoad()

		// Find and click sign up link
		const signUpLink = page.getByRole("link", { name: /sign up|create account/i })
		if (await signUpLink.isVisible()) {
			await signUpLink.click()
			await helpers.waitForPageLoad()
			expect(page.url()).toContain("sign-up")
		}

		// Navigate back to login
		const loginLink = page.getByRole("link", { name: /log in|sign in/i })
		if (await loginLink.isVisible()) {
			await loginLink.click()
			await helpers.waitForPageLoad()
			expect(page.url()).toContain("login")
		}
	})

	test("protected routes redirect to login when not authenticated", async ({ page }) => {
		// Try to access a protected route
		await page.goto("/a/test-account/home")

		// Should redirect to login
		await page.waitForURL((url) => url.pathname.includes("login") || url.pathname.includes("sign"), {
			timeout: 10_000,
		})
	})
})
