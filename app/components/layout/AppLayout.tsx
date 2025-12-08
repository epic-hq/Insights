import { useState } from "react"
import { Outlet, useSearchParams } from "react-router"
import { ChatSheet } from "~/components/chat/ChatSheet"
import { AppSidebar } from "~/components/navigation/AppSidebar"
import { BottomTabBar } from "~/components/navigation/BottomTabBar"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { useCurrentProject } from "~/contexts/current-project-context"
import { ProjectStatusAgentProvider } from "~/contexts/project-status-agent-context"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Chat sheet state
	const [isChatOpen, setIsChatOpen] = useState(false)

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	// Check if we have valid project context for chat
	const hasProjectContext = Boolean(accountId && projectId)

	// Build system context for chat
	const systemContext = `Project: ${projectPath || "Unknown"}`

	return (
		<SidebarProvider>
			{showMainNav && !isMobile && <AppSidebar />}
			<SidebarInset>
				<main
					className={cn(
						"flex min-h-screen flex-1 flex-col",
						isMobile && showJourneyNav && showMainNav ? "pb-[72px]" : ""
					)}
				>
					<Outlet />
				</main>

				{/* Mobile Bottom Tab Bar */}
				{showJourneyNav && isMobile && showMainNav && (
					<BottomTabBar
						routes={{
							crm: routes.people.index(),
							upload: routes.interviews.upload(),
							profile: `/a/${accountId}/settings`,
						}}
						onChatClick={() => setIsChatOpen(true)}
						isChatAvailable={hasProjectContext}
					/>
				)}
			</SidebarInset>

			{/* Chat Sheet (mobile) - only render when we have project context */}
			{isMobile && hasProjectContext && (
				<ProjectStatusAgentProvider>
					<ChatSheet
						open={isChatOpen}
						onOpenChange={setIsChatOpen}
						accountId={accountId}
						projectId={projectId}
						systemContext={systemContext}
					/>
				</ProjectStatusAgentProvider>
			)}
		</SidebarProvider>
	)
}
