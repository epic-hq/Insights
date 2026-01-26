/**
 * E2E Test Utilities
 *
 * Common helper functions for E2E testing with Playwright
 */
import type { Page } from "@playwright/test"

/**
 * Wait for network to be idle (no pending requests)
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
	await page.waitForLoadState("networkidle", { timeout })
}

/**
 * Wait for a specific API response
 */
export async function waitForApiResponse(
	page: Page,
	urlPattern: string | RegExp,
	options?: { timeout?: number }
) {
	return page.waitForResponse(
		(response) => {
			if (typeof urlPattern === "string") {
				return response.url().includes(urlPattern)
			}
			return urlPattern.test(response.url())
		},
		{ timeout: options?.timeout || 30_000 }
	)
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string, fullPage = true) {
	const sanitizedName = name.replace(/[^a-z0-9]/gi, "-").toLowerCase()
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
	const path = `e2e-results/screenshots/${sanitizedName}-${timestamp}.png`
	await page.screenshot({ path, fullPage })
	return path
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForElement(
	page: Page,
	selector: string,
	options?: { timeout?: number; state?: "visible" | "attached" }
) {
	await page.locator(selector).waitFor({
		state: options?.state || "visible",
		timeout: options?.timeout || 10_000,
	})
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
	await page.locator(selector).scrollIntoViewIfNeeded()
}

/**
 * Get all text content from the page
 */
export async function getPageTextContent(page: Page): Promise<string> {
	return await page.innerText("body")
}

/**
 * Check if page has any console errors
 */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
	const errors: string[] = []
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			errors.push(msg.text())
		}
	})
	return errors
}

/**
 * Generate a unique test identifier
 */
export function generateTestId(prefix = "test"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

/**
 * Wait for React hydration to complete
 */
export async function waitForHydration(page: Page, timeout = 2000) {
	// Wait a brief moment for React to hydrate
	await page.waitForTimeout(timeout)
	// Then wait for network to settle
	await page.waitForLoadState("networkidle")
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retryUntilSuccess<T>(
	fn: () => Promise<T>,
	options?: { maxRetries?: number; delayMs?: number }
): Promise<T> {
	const maxRetries = options?.maxRetries || 3
	const delayMs = options?.delayMs || 1000

	let lastError: Error | undefined
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn()
		} catch (error) {
			lastError = error as Error
			if (i < maxRetries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs))
			}
		}
	}
	throw lastError
}
