import { Outlet } from "react-router"
import { JourneyNav } from "~/components/navigation/JourneyNav"
import MainNav from "~/components/navigation/MainNav"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile, isDesktop } = useDeviceDetection()

	return (
		<div className="min-h-screen bg-background">
			{/* Main header navigation */}
			<MainNav />

			{/* Desktop top navigation - only on md+ screens */}
			{showJourneyNav && isDesktop && <JourneyNav variant="stepper" />}

			{/* Main content area */}
			<main
				className={cn(
					"flex-1 overflow-hidden",
					isMobile && showJourneyNav ? "pb-20" : "" // Add bottom padding for mobile nav
				)}
			>
				<Outlet />
			</main>

			{/* Mobile bottom navigation - only on < lg screens */}
			{showJourneyNav && isMobile && <JourneyNav variant="bottom" />}

			{/* Bottom action bar - COMMENTED OUT as requested */}
			{/* {showBottomActions && <BottomActionBar />} */}
		</div>
	)
}
