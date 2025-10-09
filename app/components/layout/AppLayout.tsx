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

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	return (
		<div className="flex h-screen bg-background">
			{showMainNav && <MainNav />}

			<div className="flex min-h-0 flex-1 flex-col">
				<main
					className={cn(
						"flex-1 overflow-y-auto",
						isMobile && showJourneyNav && showMainNav ? "pb-20" : ""
					)}
				>
					<Outlet />
				</main>
			</div>

			{showJourneyNav && isMobile && showMainNav && <JourneyNav variant="bottom" />}
		</div>
	)
}
