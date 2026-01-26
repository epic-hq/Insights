/**
 * Interactive Browser Steering Tests
 *
 * These tests are designed for Claude to interactively explore and test the app.
 * Each test provides helpers for examining page state and taking actions.
 *
 * Usage:
 * - Run with: pnpm test:e2e:debug tests/interactive.spec.ts
 * - Or headed mode: pnpm test:e2e:headed tests/interactive.spec.ts
 */
import { test, expect } from "../fixtures/base.fixture"
import { takeScreenshot, waitForHydration } from "../utils/helpers"

test.describe("Interactive Browser Steering", () => {
	/**
	 * Explore any page and report its state
	 * Claude can use this to understand what's on a page before taking action
	 */
	test("explore page state", async ({ page, helpers }) => {
		// Navigate to the target page (modify URL as needed)
		const targetUrl = process.env.E2E_TARGET_URL || "/"
		await page.goto(targetUrl)
		await helpers.waitForPageLoad()

		// Get comprehensive page state
		const state = await helpers.describePageState()
		console.log("\n=== PAGE STATE ===\n")
		console.log(state)
		console.log("\n==================\n")

		// Take a screenshot
		const screenshotPath = await takeScreenshot(page, `explore-${Date.now()}`)
		console.log(`Screenshot saved: ${screenshotPath}`)

		// Get all visible text (truncated for readability)
		const pageText = await helpers.getPageText()
		console.log("\n=== PAGE TEXT (first 2000 chars) ===\n")
		console.log(pageText.substring(0, 2000))
		console.log("\n====================================\n")
	})

	/**
	 * Navigate through the app and take screenshots at each step
	 * Useful for visual verification of user flows
	 */
	test("navigate and screenshot flow", async ({ page, helpers }) => {
		const screenshots: string[] = []

		// Step 1: Start at home
		await page.goto("/")
		await helpers.waitForPageLoad()
		screenshots.push(await takeScreenshot(page, "step-1-home"))

		// Step 2: Go to login
		await page.goto("/login")
		await helpers.waitForPageLoad()
		screenshots.push(await takeScreenshot(page, "step-2-login"))

		// Step 3: Go to sign up
		await page.goto("/sign-up")
		await helpers.waitForPageLoad()
		screenshots.push(await takeScreenshot(page, "step-3-signup"))

		console.log("\nScreenshots taken:")
		screenshots.forEach((s, i) => console.log(`  ${i + 1}. ${s}`))
	})

	/**
	 * Interactive element discovery
	 * Finds all interactive elements on the page
	 */
	test("discover interactive elements", async ({ page, helpers }) => {
		const targetUrl = process.env.E2E_TARGET_URL || "/"
		await page.goto(targetUrl)
		await helpers.waitForPageLoad()

		// Get buttons
		const buttons = await helpers.getButtons()
		console.log("\n=== BUTTONS ===")
		buttons.forEach((b) => console.log(`  - ${b}`))

		// Get links
		const links = await helpers.getLinks()
		console.log("\n=== LINKS ===")
		links.slice(0, 20).forEach((l) => console.log(`  - "${l.text}" -> ${l.href}`))
		if (links.length > 20) console.log(`  ... and ${links.length - 20} more`)

		// Get form inputs
		const inputs = await helpers.getInputs()
		console.log("\n=== FORM INPUTS ===")
		inputs.forEach((i) => console.log(`  - ${i.label} (${i.type})`))

		// Get clickable elements count
		const clickable = await page.locator('button, a, [role="button"], input[type="submit"]').count()
		console.log(`\nTotal clickable elements: ${clickable}`)
	})

	/**
	 * Click through test - clicks on elements by text
	 * Modify CLICK_TARGETS to test specific interactions
	 */
	test("click through elements", async ({ page, helpers }) => {
		// Define elements to click (modify as needed)
		const CLICK_TARGETS = process.env.E2E_CLICK_TARGETS?.split(",") || ["Sign in", "Log in"]

		await page.goto("/")
		await helpers.waitForPageLoad()

		for (const target of CLICK_TARGETS) {
			console.log(`\nAttempting to click: "${target}"`)
			const before = page.url()

			try {
				await helpers.clickByText(target.trim())
				await helpers.waitForPageLoad()
				const after = page.url()
				console.log(`  Clicked! URL changed: ${before} -> ${after}`)
				await takeScreenshot(page, `clicked-${target.trim().replace(/\s/g, "-")}`)
			} catch (error) {
				console.log(`  Could not find or click "${target}": ${(error as Error).message}`)
			}
		}
	})

	/**
	 * Form filling test
	 * Modify FORM_DATA to test form interactions
	 */
	test("fill form fields", async ({ page, helpers }) => {
		const targetUrl = process.env.E2E_FORM_URL || "/login"
		await page.goto(targetUrl)
		await helpers.waitForPageLoad()

		// Define form data (modify as needed)
		const FORM_DATA: Record<string, string> = {
			email: "test@example.com",
			password: "testpassword",
		}

		// List available inputs first
		const inputs = await helpers.getInputs()
		console.log("\nAvailable form inputs:")
		inputs.forEach((i) => console.log(`  - ${i.label} (${i.type})`))

		// Fill each field
		for (const [label, value] of Object.entries(FORM_DATA)) {
			try {
				// Try by label
				await helpers.fillByLabel(label, value)
				console.log(`Filled "${label}" with "${value}"`)
			} catch (error) {
				console.log(`Could not fill "${label}": ${(error as Error).message}`)
			}
		}

		await takeScreenshot(page, "form-filled")
	})

	/**
	 * Full page interaction test
	 * Demonstrates all helper capabilities
	 */
	test("full interaction demo", async ({ page, helpers }) => {
		console.log("\n=== FULL INTERACTION DEMO ===\n")

		// 1. Navigate
		console.log("1. Navigating to home...")
		await helpers.navigateTo("/")
		console.log(`   Current URL: ${helpers.getCurrentUrl()}`)

		// 2. Describe page
		console.log("\n2. Describing page state...")
		const state = await helpers.describePageState()
		console.log(state)

		// 3. Check visibility
		console.log("\n3. Checking for common elements...")
		const checks = ["Login", "Sign up", "Home", "Dashboard", "Projects"]
		for (const text of checks) {
			const visible = await helpers.isVisible(text)
			console.log(`   "${text}" visible: ${visible}`)
		}

		// 4. Take screenshot
		console.log("\n4. Taking screenshot...")
		const screenshotPath = await takeScreenshot(page, "full-demo")
		console.log(`   Saved: ${screenshotPath}`)

		// 5. Test keyboard
		console.log("\n5. Testing keyboard input...")
		await helpers.pressKey("Tab")
		console.log("   Pressed Tab key")

		console.log("\n=== DEMO COMPLETE ===\n")
	})
})

test.describe("Authenticated Interactive Tests", () => {
	test.skip(
		!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
		"Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables"
	)

	test.beforeEach(async ({ helpers }) => {
		await helpers.login()
	})

	/**
	 * Explore authenticated dashboard
	 */
	test("explore authenticated dashboard", async ({ page, helpers }) => {
		await helpers.navigateTo("/")
		await helpers.waitForPageLoad()

		console.log("\n=== AUTHENTICATED PAGE STATE ===\n")
		const state = await helpers.describePageState()
		console.log(state)

		await takeScreenshot(page, "authenticated-dashboard")
	})

	/**
	 * Project exploration
	 */
	test("explore projects", async ({ page, helpers }) => {
		await helpers.navigateTo("/")
		await helpers.waitForPageLoad()

		// Find project links
		const links = await helpers.getLinks()
		const projectLinks = links.filter((l) => l.href.includes("/a/"))

		console.log("\n=== PROJECT LINKS ===")
		projectLinks.slice(0, 10).forEach((l) => console.log(`  - "${l.text}" -> ${l.href}`))

		// Click first project if available
		if (projectLinks.length > 0) {
			await helpers.clickByText(projectLinks[0].text)
			await helpers.waitForPageLoad()
			console.log("\n=== PROJECT PAGE STATE ===\n")
			console.log(await helpers.describePageState())
			await takeScreenshot(page, "project-page")
		}
	})
})
