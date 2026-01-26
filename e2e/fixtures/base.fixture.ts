/**
 * Base Playwright Fixtures
 *
 * Provides custom fixtures for E2E testing including:
 * - Authentication helpers
 * - Navigation utilities
 * - Screenshot helpers for debugging
 * - Wait utilities for AI-driven testing
 */
import { test as base, expect, type Page, type Locator } from "@playwright/test"

// Test user credentials (should match test database)
export const TEST_USER = {
	email: process.env.E2E_TEST_EMAIL || "test@example.com",
	password: process.env.E2E_TEST_PASSWORD || "testpassword123",
}

/**
 * Custom test context with helper methods for Claude to steer the browser
 */
export interface TestHelpers {
	/**
	 * Take a screenshot and save it with a descriptive name
	 * Useful for Claude to see the current state of the page
	 */
	screenshot: (name: string) => Promise<string>

	/**
	 * Wait for the page to be fully loaded and stable
	 */
	waitForPageLoad: () => Promise<void>

	/**
	 * Click an element by its text content
	 */
	clickByText: (text: string, options?: { exact?: boolean }) => Promise<void>

	/**
	 * Fill an input field by its label
	 */
	fillByLabel: (label: string, value: string) => Promise<void>

	/**
	 * Navigate to a specific route and wait for it to load
	 */
	navigateTo: (path: string) => Promise<void>

	/**
	 * Log in with test credentials
	 */
	login: (email?: string, password?: string) => Promise<void>

	/**
	 * Log out the current user
	 */
	logout: () => Promise<void>

	/**
	 * Check if an element with text is visible
	 */
	isVisible: (text: string) => Promise<boolean>

	/**
	 * Wait for an element to appear
	 */
	waitForText: (text: string, timeout?: number) => Promise<void>

	/**
	 * Get all visible text on the page (useful for Claude to understand page state)
	 */
	getPageText: () => Promise<string>

	/**
	 * Get the current URL
	 */
	getCurrentUrl: () => string

	/**
	 * Press a keyboard key
	 */
	pressKey: (key: string) => Promise<void>

	/**
	 * Select an option from a dropdown/select by label
	 */
	selectByLabel: (label: string, optionText: string) => Promise<void>

	/**
	 * Get all links on the page
	 */
	getLinks: () => Promise<Array<{ text: string; href: string }>>

	/**
	 * Get all buttons on the page
	 */
	getButtons: () => Promise<string[]>

	/**
	 * Get all form inputs on the page
	 */
	getInputs: () => Promise<Array<{ label: string; type: string; value: string }>>

	/**
	 * Describe the current page state (useful for Claude)
	 */
	describePageState: () => Promise<string>
}

/**
 * Extended test fixture with helpers for Claude-driven testing
 */
export const test = base.extend<{ helpers: TestHelpers }>({
	helpers: async ({ page }, use) => {
		const helpers: TestHelpers = {
			screenshot: async (name: string) => {
				const sanitizedName = name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
				const path = `e2e-results/screenshots/${sanitizedName}-${Date.now()}.png`
				await page.screenshot({ path, fullPage: true })
				return path
			},

			waitForPageLoad: async () => {
				await page.waitForLoadState("networkidle")
				// Wait for any React hydration
				await page.waitForTimeout(500)
			},

			clickByText: async (text: string, options?: { exact?: boolean }) => {
				const locator = page.getByText(text, { exact: options?.exact ?? false })
				await locator.first().click()
			},

			fillByLabel: async (label: string, value: string) => {
				await page.getByLabel(label).fill(value)
			},

			navigateTo: async (path: string) => {
				await page.goto(path)
				await helpers.waitForPageLoad()
			},

			login: async (email?: string, password?: string) => {
				await page.goto("/login")
				await helpers.waitForPageLoad()

				await page.getByLabel(/email/i).fill(email || TEST_USER.email)
				await page.getByLabel(/password/i).fill(password || TEST_USER.password)
				await page.getByRole("button", { name: /sign in|log in/i }).click()

				// Wait for redirect after login
				await page.waitForURL((url) => !url.pathname.includes("/login"), {
					timeout: 30_000,
				})
				await helpers.waitForPageLoad()
			},

			logout: async () => {
				// Try to find and click logout button/link
				const logoutButton = page.getByRole("button", { name: /log out|sign out/i })
				const logoutLink = page.getByRole("link", { name: /log out|sign out/i })

				if (await logoutButton.isVisible()) {
					await logoutButton.click()
				} else if (await logoutLink.isVisible()) {
					await logoutLink.click()
				} else {
					// Try navigating to logout route directly
					await page.goto("/logout")
				}
				await helpers.waitForPageLoad()
			},

			isVisible: async (text: string) => {
				const locator = page.getByText(text)
				return await locator.isVisible()
			},

			waitForText: async (text: string, timeout = 10_000) => {
				await page.getByText(text).waitFor({ timeout })
			},

			getPageText: async () => {
				return await page.innerText("body")
			},

			getCurrentUrl: () => {
				return page.url()
			},

			pressKey: async (key: string) => {
				await page.keyboard.press(key)
			},

			selectByLabel: async (label: string, optionText: string) => {
				const select = page.getByLabel(label)
				await select.selectOption({ label: optionText })
			},

			getLinks: async () => {
				const links = await page.locator("a[href]").all()
				const results: Array<{ text: string; href: string }> = []
				for (const link of links) {
					const text = (await link.innerText()).trim()
					const href = (await link.getAttribute("href")) || ""
					if (text) {
						results.push({ text, href })
					}
				}
				return results
			},

			getButtons: async () => {
				const buttons = await page.locator("button").all()
				const results: string[] = []
				for (const button of buttons) {
					const text = (await button.innerText()).trim()
					if (text) {
						results.push(text)
					}
				}
				return results
			},

			getInputs: async () => {
				const inputs = await page.locator("input, textarea, select").all()
				const results: Array<{ label: string; type: string; value: string }> = []
				for (const input of inputs) {
					const id = await input.getAttribute("id")
					const name = await input.getAttribute("name")
					const type = (await input.getAttribute("type")) || "text"
					const value = (await input.inputValue().catch(() => "")) || ""

					// Try to find associated label
					let label = ""
					if (id) {
						const labelEl = page.locator(`label[for="${id}"]`)
						if (await labelEl.isVisible()) {
							label = await labelEl.innerText()
						}
					}
					if (!label) {
						label = name || id || "unknown"
					}

					results.push({ label: label.trim(), type, value })
				}
				return results
			},

			describePageState: async () => {
				const url = helpers.getCurrentUrl()
				const title = await page.title()
				const buttons = await helpers.getButtons()
				const links = await helpers.getLinks()
				const inputs = await helpers.getInputs()

				let description = `Page State:
URL: ${url}
Title: ${title}

Buttons (${buttons.length}):
${buttons.slice(0, 20).map((b) => `  - ${b}`).join("\n")}
${buttons.length > 20 ? `  ... and ${buttons.length - 20} more` : ""}

Links (${links.length}):
${links.slice(0, 20).map((l) => `  - "${l.text}" -> ${l.href}`).join("\n")}
${links.length > 20 ? `  ... and ${links.length - 20} more` : ""}

Form Inputs (${inputs.length}):
${inputs.slice(0, 10).map((i) => `  - ${i.label} (${i.type}): "${i.value}"`).join("\n")}
${inputs.length > 10 ? `  ... and ${inputs.length - 10} more` : ""}
`
				return description
			},
		}

		await use(helpers)
	},
})

export { expect }
