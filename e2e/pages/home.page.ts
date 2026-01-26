/**
 * Home/Dashboard Page Object Model
 *
 * Encapsulates interactions with the home dashboard page
 */
import type { Page, Locator } from "@playwright/test"

export class HomePage {
	readonly page: Page
	readonly createProjectButton: Locator
	readonly projectsList: Locator
	readonly userMenu: Locator
	readonly settingsLink: Locator
	readonly logoutButton: Locator
	readonly searchInput: Locator
	readonly sidebar: Locator
	readonly mainContent: Locator

	constructor(page: Page) {
		this.page = page
		this.createProjectButton = page.getByRole("button", { name: /create|new project/i })
		this.projectsList = page.locator('[data-testid="projects-list"], .projects-list')
		this.userMenu = page.locator('[data-testid="user-menu"], .user-menu, [aria-label="User menu"]')
		this.settingsLink = page.getByRole("link", { name: /settings/i })
		this.logoutButton = page.getByRole("button", { name: /log out|sign out/i })
		this.searchInput = page.getByPlaceholder(/search/i)
		this.sidebar = page.locator('[data-testid="sidebar"], aside, nav')
		this.mainContent = page.locator('main, [role="main"]')
	}

	async goto(accountId?: string) {
		if (accountId) {
			await this.page.goto(`/a/${accountId}/home`)
		} else {
			// Navigate to root and let redirect happen
			await this.page.goto("/")
		}
		await this.page.waitForLoadState("networkidle")
	}

	async waitForDashboard() {
		// Wait for main content to be visible
		await this.mainContent.waitFor({ state: "visible", timeout: 30_000 })
	}

	async clickCreateProject() {
		await this.createProjectButton.click()
	}

	async openUserMenu() {
		await this.userMenu.click()
	}

	async logout() {
		await this.openUserMenu()
		await this.logoutButton.click()
	}

	async searchProjects(query: string) {
		await this.searchInput.fill(query)
		await this.page.keyboard.press("Enter")
	}

	async getProjectCards(): Promise<Locator> {
		return this.page.locator('[data-testid="project-card"], .project-card, [href*="/projects/"]')
	}

	async clickFirstProject() {
		const projectCards = await this.getProjectCards()
		await projectCards.first().click()
	}

	async isOnHomePage(): Promise<boolean> {
		const url = this.page.url()
		return url.includes("/home") || url.endsWith("/")
	}
}
