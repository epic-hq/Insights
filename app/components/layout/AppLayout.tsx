import { Outlet } from "react-router"
import { JourneyNav } from "~/components/navigation/JourneyNav"
import MainNav from "~/components/navigation/MainNav"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
	showStepper?: boolean
}

export function AppLayout({ showJourneyNav = true, showStepper = true }: AppLayoutProps) {
	const { isMobile, isDesktop } = useDeviceDetection()

	return (
		<div className="min-h-screen bg-background">
			{/* Main header navigation */}
			<MainNav />

			{/* Progress stepper - desktop only, replaces top nav confusion */}
			{showStepper && isDesktop && <JourneyNav variant="stepper" />}

			<div className="flex flex-1">
				{/* Desktop sidebar navigation - only show if not showing stepper to avoid confusion */}
				{showJourneyNav && isDesktop && !showStepper && <JourneyNav variant="sidebar" />}

				{/* Main content area */}
				<main
					className={cn(
						"flex-1 overflow-hidden",
						isMobile && showJourneyNav ? "pb-20" : "" // Add bottom padding for mobile nav
					)}
				>
					<Outlet />
				</main>
			</div>

			{/* Mobile bottom navigation */}
			{showJourneyNav && isMobile && <JourneyNav variant="bottom" />}
		</div>
	)
}
