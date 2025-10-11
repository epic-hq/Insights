import { Outlet, useSearchParams } from "react-router"
import { AppSidebar } from "~/components/navigation/AppSidebar"
import { JourneyNav } from "~/components/navigation/JourneyNav"
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	return (
		<SidebarProvider>
			{showMainNav && <AppSidebar />}
			<SidebarInset>
				<main
					className={cn("flex min-h-screen flex-1 flex-col", isMobile && showJourneyNav && showMainNav ? "pb-20" : "")}
				>
					<Outlet />
				</main>
				{showJourneyNav && isMobile && showMainNav && <JourneyNav variant="bottom" />}
			</SidebarInset>
		</SidebarProvider>
	)
}
