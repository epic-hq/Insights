import { Outlet, useSearchParams } from "react-router"
import { JourneyNav } from "~/components/navigation/JourneyNav"
import MainNav from "~/components/navigation/MainNav"
import { useDeviceDetection } from "~/hooks/useDeviceDetection"
import { cn } from "~/lib/utils"

interface AppLayoutProps {
	showJourneyNav?: boolean
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()

	// Check if user is in onboarding flow
	const isOnboarding = searchParams.get("onboarding") === "true"

	// Hide main navigation during onboarding
	const showMainNav = !isOnboarding

	return (
		<div className="min-h-screen bg-background">
			{/* Main header navigation - hidden during onboarding */}
			{showMainNav && <MainNav />}

			{/* Main content area */}
			<main
				className={cn(
					"flex-1 overflow-hidden",
					isMobile && showJourneyNav && showMainNav ? "pb-20" : "" // Add bottom padding for mobile nav only when nav is shown
				)}
			>
				<Outlet />
			</main>

			{/* Mobile bottom navigation - only on < lg screens and not in onboarding */}
			{showJourneyNav && isMobile && showMainNav && <JourneyNav variant="bottom" />}

			{/* Bottom action bar - COMMENTED OUT as requested */}
			{/* {showBottomActions && <BottomActionBar />} */}
		</div>
	)
}
