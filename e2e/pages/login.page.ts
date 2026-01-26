/**
 * Login Page Object Model
 *
 * Encapsulates interactions with the login page for E2E testing
 */
import type { Page, Locator } from "@playwright/test"

export class LoginPage {
	readonly page: Page
	readonly emailInput: Locator
	readonly passwordInput: Locator
	readonly signInButton: Locator
	readonly signUpLink: Locator
	readonly forgotPasswordLink: Locator
	readonly errorMessage: Locator
	readonly googleSignInButton: Locator

	constructor(page: Page) {
		this.page = page
		this.emailInput = page.getByLabel(/email/i)
		this.passwordInput = page.getByLabel(/password/i)
		this.signInButton = page.getByRole("button", { name: /sign in|log in/i })
		this.signUpLink = page.getByRole("link", { name: /sign up|create account/i })
		this.forgotPasswordLink = page.getByRole("link", { name: /forgot password/i })
		this.errorMessage = page.locator('[role="alert"], .error-message, [data-error]')
		this.googleSignInButton = page.getByRole("button", { name: /google|continue with google/i })
	}

	async goto() {
		await this.page.goto("/login")
		await this.page.waitForLoadState("networkidle")
	}

	async login(email: string, password: string) {
		await this.emailInput.fill(email)
		await this.passwordInput.fill(password)
		await this.signInButton.click()
	}

	async loginAndWaitForRedirect(email: string, password: string) {
		await this.login(email, password)
		// Wait for navigation away from login page
		await this.page.waitForURL((url) => !url.pathname.includes("/login"), {
			timeout: 30_000,
		})
	}

	async getErrorMessage(): Promise<string | null> {
		if (await this.errorMessage.isVisible()) {
			return await this.errorMessage.innerText()
		}
		return null
	}

	async isOnLoginPage(): Promise<boolean> {
		return this.page.url().includes("/login")
	}
}
