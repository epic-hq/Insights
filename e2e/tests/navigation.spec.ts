/**
 * Navigation Tests
 *
 * Tests for navigating through the application.
 * These tests verify that navigation works correctly and pages load.
 */
import { test, expect, TEST_USER } from "../fixtures/base.fixture"
import { HomePage, ProjectPage } from "../pages"

test.describe("Navigation", () => {
	test.describe("Unauthenticated", () => {
		test("public pages are accessible", async ({ page, helpers }) => {
			// Welcome page
			await page.goto("/welcome")
			await helpers.waitForPageLoad()
			const welcomeText = await helpers.getPageText()
			expect(welcomeText.length).toBeGreaterThan(0)

			// Login page
			await page.goto("/login")
			await helpers.waitForPageLoad()
			expect(page.url()).toContain("login")

			// Sign up page
			await page.goto("/sign-up")
			await helpers.waitForPageLoad()
			expect(page.url()).toContain("sign-up")
		})

		test("protected routes require authentication", async ({ page, helpers }) => {
			// List of protected route patterns to check
			const protectedRoutes = ["/a/test-account/home", "/a/test-account/test-project"]

			for (const route of protectedRoutes) {
				await page.goto(route)
				// Should redirect to login or show auth required
				await page.waitForURL(
					(url) =>
						url.pathname.includes("login") ||
						url.pathname.includes("sign") ||
						url.pathname.includes("auth"),
					{ timeout: 10_000 }
				)
			}
		})
	})

	test.describe("Authenticated Navigation", () => {
		test.skip(
			!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
			"Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables"
		)

		test.beforeEach(async ({ helpers }) => {
			await helpers.login()
		})

		test("can navigate to home dashboard", async ({ page, helpers }) => {
			const homePage = new HomePage(page)
			await homePage.goto()
			await homePage.waitForDashboard()

			// Dashboard should load
			expect(await homePage.isOnHomePage()).toBe(true)
		})

		test("can use page state description for debugging", async ({ page, helpers }) => {
			// Navigate to a page
			await helpers.navigateTo("/")
			await helpers.waitForPageLoad()

			// Get page state (useful for Claude to understand current state)
			const state = await helpers.describePageState()
			expect(state).toContain("URL:")
			expect(state).toContain("Title:")
			expect(state).toContain("Buttons")
			expect(state).toContain("Links")

			// Log state for debugging
			console.log("Current page state:\n", state)
		})

		test("sidebar navigation works", async ({ page, helpers }) => {
			await helpers.navigateTo("/")
			await helpers.waitForPageLoad()

			// Get all navigation links
			const links = await helpers.getLinks()

			// Should have navigation links
			expect(links.length).toBeGreaterThan(0)

			// Log available links for debugging
			console.log(
				"Available links:",
				links.slice(0, 10).map((l) => l.text)
			)
		})
	})
})

test.describe("Project Navigation", () => {
	test.skip(
		!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
		"Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables"
	)

	test.beforeEach(async ({ helpers }) => {
		await helpers.login()
	})

	test("can navigate to project tabs", async ({ page, helpers }) => {
		// Navigate to home first
		await helpers.navigateTo("/")
		await helpers.waitForPageLoad()

		// Try to find and click on a project
		const projectLinks = page.locator('a[href*="/a/"]').filter({ hasText: /.+/ })
		const count = await projectLinks.count()

		if (count > 0) {
			// Click first project
			await projectLinks.first().click()
			await helpers.waitForPageLoad()

			// Now on project page, check for tab navigation
			const projectPage = new ProjectPage(page)

			// Check if we can see project tabs
			const tabs = [
				projectPage.interviewsTab,
				projectPage.insightsTab,
				projectPage.evidenceTab,
				projectPage.peopleTab,
			]

			for (const tab of tabs) {
				const isVisible = await tab.isVisible().catch(() => false)
				if (isVisible) {
					console.log(`Tab visible: ${await tab.textContent()}`)
				}
			}
		}
	})
})
