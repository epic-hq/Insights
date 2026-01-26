/**
 * Authentication Tests
 *
 * Tests for login, logout, and authentication flows.
 * Note: These tests require test credentials configured in environment variables.
 */
import { test, expect, TEST_USER } from "../fixtures/base.fixture"
import { LoginPage } from "../pages"

test.describe("Authentication", () => {
	test("shows error for invalid credentials", async ({ page, helpers }) => {
		const loginPage = new LoginPage(page)
		await loginPage.goto()

		// Try to login with invalid credentials
		await loginPage.login("invalid@example.com", "wrongpassword")

		// Wait for error response
		await page.waitForTimeout(2000)

		// Should still be on login page
		expect(await loginPage.isOnLoginPage()).toBe(true)
	})

	test("email input validates email format", async ({ page }) => {
		const loginPage = new LoginPage(page)
		await loginPage.goto()

		// Enter invalid email
		await loginPage.emailInput.fill("not-an-email")
		await loginPage.passwordInput.fill("somepassword")
		await loginPage.signInButton.click()

		// Browser should show validation error
		const emailValidity = await loginPage.emailInput.evaluate(
			(el: HTMLInputElement) => el.validity.valid
		)
		expect(emailValidity).toBe(false)
	})

	test("password field hides input", async ({ page }) => {
		const loginPage = new LoginPage(page)
		await loginPage.goto()

		// Password input should be type="password"
		const passwordType = await loginPage.passwordInput.getAttribute("type")
		expect(passwordType).toBe("password")
	})

	test.describe("Authenticated User", () => {
		test.skip(
			!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
			"Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables"
		)

		test("can login with valid credentials", async ({ page, helpers }) => {
			const loginPage = new LoginPage(page)
			await loginPage.goto()

			await loginPage.loginAndWaitForRedirect(TEST_USER.email, TEST_USER.password)

			// Should be redirected away from login
			expect(await loginPage.isOnLoginPage()).toBe(false)
		})

		test("can logout after login", async ({ page, helpers }) => {
			// Login first
			await helpers.login()

			// Should be on authenticated page
			expect(page.url()).not.toContain("/login")

			// Logout
			await helpers.logout()

			// Should be back at login or home
			await helpers.waitForPageLoad()
		})
	})
})
