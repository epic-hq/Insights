/**
 * AppLayout - Main application layout wrapper
 *
 * Provides:
 * - Desktop: Sidebar navigation
 * - Mobile: Bottom tab bar + Profile sheet
 */

import { useState } from "react"
import { Outlet, useSearchParams } from "react-router"
import { AppSidebar } from "~/components/navigation/AppSidebar"
import { BottomTabBar } from "~/components/navigation/BottomTabBar"
import { ProfileSheet } from "~/components/navigation/ProfileSheet"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Profile sheet state
	const [isProfileOpen, setIsProfileOpen] = useState(false)

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	// Should we show the mobile navigation?
	const showMobileNav = isMobile && showJourneyNav && showMainNav

	return (
		<SidebarProvider>
			{showMainNav && !isMobile && <AppSidebar />}
			<SidebarInset>
				<main className={cn("flex min-h-screen flex-1 flex-col", showMobileNav ? "pb-[72px]" : "")}>
					<Outlet />
				</main>

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
			</SidebarInset>

			{/* Profile Sheet (mobile) */}
			{isMobile && (
				<ProfileSheet
					open={isProfileOpen}
					onOpenChange={setIsProfileOpen}
					accountSettingsHref={`/a/${accountId}/settings`}
				/>
			)}
		</SidebarProvider>
	)
}
