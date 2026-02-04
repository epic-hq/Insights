/**
 * SplitPaneLayout - New layout with horizontal nav and AI panel
 *
 * Layout structure:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Top Navigation Bar                          │
 * ├───────────────────┬─────────────────────────────────────────────┤
 * │   AI Assistant    │                                             │
 * │   Panel           │           Main Content Area                 │
 * │   (Collapsible)   │           (Outlet)                          │
 * │                   │                                             │
 * └───────────────────┴─────────────────────────────────────────────┘
 *
 * Features:
 * - Horizontal top navigation with mega-menu dropdowns
 * - Collapsible AI assistant panel on the left
 * - Main content area that fills remaining space
 * - Mobile: AI panel hidden, hamburger menu for nav
 */

import { useCallback, useState } from "react"
import { Outlet, useRouteLoaderData, useSearchParams } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"
import { BottomTabBar } from "../navigation/BottomTabBar"
import { ProfileSheet } from "../navigation/ProfileSheet"
import { TopNavigation } from "../navigation/TopNavigation"
import { useOnboarding } from "../onboarding"
import { AIAssistantPanel } from "./AIAssistantPanel"

interface AccountRecord {
	account_id: string
	name?: string | null
	personal_account?: boolean | null
	projects?: Array<{
		id: string
		account_id: string
		name?: string | null
		slug?: string | null
	}> | null
}

interface ProtectedLayoutData {
	accounts?: AccountRecord[] | null
	user_settings?: {
		last_used_account_id?: string | null
		last_used_project_id?: string | null
	} | null
}

interface SplitPaneLayoutProps {
	/** System context for AI chat */
	systemContext?: string
	/** Whether to show the journey navigation (onboarding) */
	showJourneyNav?: boolean
}

export function SplitPaneLayout({ systemContext = "", showJourneyNav = true }: SplitPaneLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null
	const { aiContext: onboardingContext } = useOnboarding()

	// Combine system context with onboarding context for personalized AI
	const combinedSystemContext = [systemContext, onboardingContext].filter(Boolean).join("\n\n")

	// AI Panel state - persisted to localStorage
	const [isAIPanelOpen, setIsAIPanelOpen] = useState(() => {
		if (typeof window === "undefined") return true
		const stored = localStorage.getItem("ai-panel-open")
		// Default to open for new users
		return stored !== "false"
	})

	// Profile sheet state (mobile)
	const [isProfileOpen, setIsProfileOpen] = useState(false)

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	// Should we show the mobile navigation?
	const showMobileNav = isMobile && showJourneyNav && showMainNav

	const accounts = protectedData?.accounts?.filter(Boolean) ?? []

	const handleAIPanelToggle = useCallback(() => {
		setIsAIPanelOpen((prev) => !prev)
	}, [])

	const handleAIPanelOpenChange = useCallback((open: boolean) => {
		setIsAIPanelOpen(open)
	}, [])

	return (
		<div className="flex h-screen flex-col">
			{/* Top Navigation - hidden on mobile, shown on desktop */}
			{showMainNav && !isMobile && (
				<TopNavigation
					accounts={accounts}
					onToggleAIPanel={handleAIPanelToggle}
					isAIPanelOpen={isAIPanelOpen}
				/>
			)}

			{/* Main content area with AI panel */}
			<div className="flex min-h-0 flex-1">
				{/* AI Assistant Panel - hidden on mobile */}
				{showMainNav && !isMobile && (
					<AIAssistantPanel
						isOpen={isAIPanelOpen}
						onOpenChange={handleAIPanelOpenChange}
						accounts={accounts}
						systemContext={combinedSystemContext}
					/>
				)}

				{/* Main content */}
				<main
					className={cn(
						"flex min-h-0 flex-1 flex-col overflow-auto",
						showMobileNav ? "pb-[72px]" : ""
					)}
				>
					<Outlet />
				</main>
			</div>

			{/* Mobile Bottom Tab Bar */}
			{showMobileNav && (
				<BottomTabBar
					routes={{
						dashboard: `${projectPath}/dashboard`,
						contacts: routes.people.index(),
						content: routes.interviews.index(),
						chat: `${projectPath}/assistant`,
						insights: routes.insights.cards(),
						upload: routes.interviews.upload(),
					}}
					onProfileClick={() => setIsProfileOpen(true)}
				/>
			)}

			{/* Profile Sheet (mobile) */}
			{isMobile && (
				<ProfileSheet
					open={isProfileOpen}
					onOpenChange={setIsProfileOpen}
					accountSettingsHref={`/a/${accountId}/settings`}
				/>
			)}
		</div>
	)
}

export default SplitPaneLayout
