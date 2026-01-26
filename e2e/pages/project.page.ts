/**
 * Project Detail Page Object Model
 *
 * Encapsulates interactions with the project detail pages
 */
import type { Page, Locator } from "@playwright/test"

export class ProjectPage {
	readonly page: Page
	readonly projectTitle: Locator
	readonly interviewsTab: Locator
	readonly insightsTab: Locator
	readonly evidenceTab: Locator
	readonly peopleTab: Locator
	readonly settingsTab: Locator
	readonly uploadButton: Locator
	readonly analyzeButton: Locator
	readonly sidebar: Locator
	readonly mainContent: Locator

	constructor(page: Page) {
		this.page = page
		this.projectTitle = page.locator("h1, [data-testid='project-title']")
		this.interviewsTab = page.getByRole("link", { name: /interviews/i })
		this.insightsTab = page.getByRole("link", { name: /insights/i })
		this.evidenceTab = page.getByRole("link", { name: /evidence/i })
		this.peopleTab = page.getByRole("link", { name: /people/i })
		this.settingsTab = page.getByRole("link", { name: /settings/i })
		this.uploadButton = page.getByRole("button", { name: /upload|add interview/i })
		this.analyzeButton = page.getByRole("button", { name: /analyze/i })
		this.sidebar = page.locator('[data-testid="sidebar"], aside')
		this.mainContent = page.locator('main, [role="main"]')
	}

	async goto(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}`)
		await this.page.waitForLoadState("networkidle")
	}

	async gotoInterviews(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}/interviews`)
		await this.page.waitForLoadState("networkidle")
	}

	async gotoInsights(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}/insights`)
		await this.page.waitForLoadState("networkidle")
	}

	async gotoEvidence(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}/evidence`)
		await this.page.waitForLoadState("networkidle")
	}

	async gotoPeople(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}/people`)
		await this.page.waitForLoadState("networkidle")
	}

	async gotoSettings(accountId: string, projectId: string) {
		await this.page.goto(`/a/${accountId}/${projectId}/settings`)
		await this.page.waitForLoadState("networkidle")
	}

	async navigateToInterviews() {
		await this.interviewsTab.click()
		await this.page.waitForLoadState("networkidle")
	}

	async navigateToInsights() {
		await this.insightsTab.click()
		await this.page.waitForLoadState("networkidle")
	}

	async navigateToEvidence() {
		await this.evidenceTab.click()
		await this.page.waitForLoadState("networkidle")
	}

	async navigateToPeople() {
		await this.peopleTab.click()
		await this.page.waitForLoadState("networkidle")
	}

	async navigateToSettings() {
		await this.settingsTab.click()
		await this.page.waitForLoadState("networkidle")
	}

	async clickUpload() {
		await this.uploadButton.click()
	}

	async clickAnalyze() {
		await this.analyzeButton.click()
	}

	async getProjectTitle(): Promise<string> {
		return await this.projectTitle.innerText()
	}

	async waitForContent() {
		await this.mainContent.waitFor({ state: "visible", timeout: 30_000 })
	}

	async isOnProjectPage(): Promise<boolean> {
		const url = this.page.url()
		// URL pattern: /a/{accountId}/{projectId}
		return /\/a\/[^/]+\/[^/]+/.test(url)
	}
}
