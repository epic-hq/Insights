/**
 * AppLayout - Main application layout wrapper
 *
 * Layout modes (selected via ?layout= URL param):
 * - (default): Agent-first layout — chat centered or two-column with canvas
 * - ?layout=legacy: Old floating AI panel overlay layout
 * - ?layout=sidebar: Legacy sidebar layout
 */

import { lazy, Suspense, useCallback, useState } from "react";
import { Outlet, useSearchParams } from "react-router";
import { AppSidebar } from "~/components/navigation/AppSidebar";
import { BottomTabBar } from "~/components/navigation/BottomTabBar";
import { ProfileSheet } from "~/components/navigation/ProfileSheet";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { SplitPaneLayout } from "./SplitPaneLayout";

const LegacyFloatingPanelLayout = lazy(() => import("./LegacyFloatingPanelLayout"));

interface AppLayoutProps {
	showJourneyNav?: boolean;
}

export function AppLayout({ showJourneyNav = true }: AppLayoutProps) {
	const { isMobile } = useDeviceDetection();
	const [searchParams] = useSearchParams();
	const { accountId, projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");

	const persistSidebarPreference = useCallback((openState: boolean) => {
		if (typeof window === "undefined") return;
		const serializedState = openState ? "expanded" : "collapsed";
		const cookieStoreCandidate = (
			window as typeof window & {
				cookieStore?: {
					set?: (options: { name: string; value: string; expires?: number; path?: string }) => Promise<void>;
				};
			}
		).cookieStore;
		if (cookieStoreCandidate?.set) {
			void cookieStoreCandidate.set({
				name: "sidebar_state",
				value: serializedState,
				expires: Date.now() + 60 * 60 * 24 * 7 * 1000,
				path: "/",
			});
			return;
		}
		try {
			window.localStorage.setItem("sidebar_state", serializedState);
		} catch {
			return;
		}
	}, []);

	const [sidebarOpen, setSidebarOpen] = useState(() => {
		if (typeof window === "undefined") return true;
		try {
			return window.localStorage.getItem("sidebar_state") !== "collapsed";
		} catch {
			return true;
		}
	});

	const [isProfileOpen, setIsProfileOpen] = useState(false);

	const isOnboarding = searchParams.get("onboarding") === "true";
	const showMainNav = !isOnboarding;
	const showMobileNav = isMobile && showJourneyNav && showMainNav;

	const handleSidebarOpenChange = useCallback(
		(nextOpen: boolean) => {
			setSidebarOpen(nextOpen);
			persistSidebarPreference(nextOpen);
		},
		[persistSidebarPreference]
	);

	const layoutMode = searchParams.get("layout");

	// Default: agent-first layout
	if (!layoutMode) {
		return <SplitPaneLayout showJourneyNav={showJourneyNav} />;
	}

	// Legacy floating panel layout (accessible via ?layout=legacy)
	if (layoutMode === "legacy") {
		return (
			<Suspense fallback={null}>
				<LegacyFloatingPanelLayout showJourneyNav={showJourneyNav} />
			</Suspense>
		);
	}

	// Legacy sidebar layout (accessible via ?layout=sidebar)
	return (
		<SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
			{showMainNav && !isMobile && <AppSidebar />}
			<SidebarInset>
				<main className={cn("flex min-h-screen flex-1 flex-col", showMobileNav ? "pb-[72px]" : "")}>
					<Outlet />
				</main>

				{showMobileNav && (
					<BottomTabBar
						routes={{
							chat: `${projectPath}/assistant`,
							upload: routes.interviews.upload(),
							people: routes.people.index(),
						}}
					/>
				)}
			</SidebarInset>

			{isMobile && (
				<ProfileSheet
					open={isProfileOpen}
					onOpenChange={setIsProfileOpen}
					accountSettingsHref={`/a/${accountId}/settings`}
				/>
			)}
		</SidebarProvider>
	);
}
