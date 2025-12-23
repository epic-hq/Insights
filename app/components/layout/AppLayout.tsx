/**
 * AppLayout - Main application layout wrapper
 *
 * Provides:
 * - Desktop: Sidebar navigation
 * - Mobile: Bottom tab bar + Profile sheet
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

export type AppLayoutOutletContext = {
	setForceSidebarCollapsed: (collapsed: boolean) => void
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection()
	const [searchParams] = useSearchParams()
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const persistSidebarPreference = useCallback((openState: boolean) => {
		if (typeof window === "undefined") return
		const serializedState = openState ? "expanded" : "collapsed"
		const cookieStoreCandidate = (
			window as typeof window & {
				cookieStore?: {
					set?: (options: { name: string; value: string; expires?: number; path?: string }) => Promise<void>
				}
			}
		).cookieStore
		if (cookieStoreCandidate?.set) {
			void cookieStoreCandidate.set({
				name: "sidebar_state",
				value: serializedState,
				expires: Date.now() + 60 * 60 * 24 * 7 * 1000,
				path: "/",
			})
			return
		}
		try {
			window.localStorage.setItem("sidebar_state", serializedState)
		} catch {
			return
		}
	}, [])

	const [sidebarOpen, setSidebarOpen] = useState(() => {
		if (typeof window === "undefined") return true
		try {
			return window.localStorage.getItem("sidebar_state") !== "collapsed"
		} catch {
			return true
		}
	})
	const [forceSidebarCollapsed, setForceSidebarCollapsedState] = useState(false)
	const wasSidebarOpenBeforeForceRef = useRef(sidebarOpen)
	const prevForceSidebarCollapsedRef = useRef(false)

	// Profile sheet state
	const [isProfileOpen, setIsProfileOpen] = useState(false)

	const isOnboarding = searchParams.get("onboarding") === "true"
	const showMainNav = !isOnboarding

	// Should we show the mobile navigation?
	const showMobileNav = isMobile && showJourneyNav && showMainNav

	const setForceSidebarCollapsed = useCallback((collapsed: boolean) => {
		setForceSidebarCollapsedState(collapsed)
	}, [])

	const outletContext = useMemo<AppLayoutOutletContext>(
		() => ({
			setForceSidebarCollapsed,
		}),
		[setForceSidebarCollapsed]
	)

	useEffect(() => {
		const wasForced = prevForceSidebarCollapsedRef.current
		const isForced = forceSidebarCollapsed
		prevForceSidebarCollapsedRef.current = isForced

		if (!wasForced && isForced) {
			wasSidebarOpenBeforeForceRef.current = sidebarOpen
			if (sidebarOpen) {
				setSidebarOpen(false)
			}
			return
		}

		if (wasForced && !isForced && wasSidebarOpenBeforeForceRef.current) {
			setSidebarOpen(true)
		}
	}, [forceSidebarCollapsed, sidebarOpen])

	const handleSidebarOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (forceSidebarCollapsed) {
				setSidebarOpen(false)
				return
			}
			setSidebarOpen(nextOpen)
			persistSidebarPreference(nextOpen)
		},
		[forceSidebarCollapsed, persistSidebarPreference]
	)

	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
			{showMainNav && !isMobile && <AppSidebar forceSidebarCollapsed={forceSidebarCollapsed} />}
			<SidebarInset>
				<main className={cn("flex min-h-screen flex-1 flex-col", showMobileNav ? "pb-[72px]" : "")}>
					<Outlet context={outletContext} />
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
