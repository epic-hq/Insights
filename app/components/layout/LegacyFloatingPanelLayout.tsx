/**
 * LegacyFloatingPanelLayout - Old floating AI panel layout
 *
 * Preserved as a fallback via ?layout=legacy URL param.
 * This is the pre-agent-first layout where the AI assistant
 * is a floating overlay panel on the left side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useRouteLoaderData, useSearchParams } from "react-router";
import { CanvasPanel } from "~/components/gen-ui/CanvasPanel";
import { SidebarProvider } from "~/components/ui/sidebar";
import { A2UISurfaceProvider, useA2UISurfaceOptional } from "~/contexts/a2ui-surface-context";
import { useCurrentProject } from "~/contexts/current-project-context";
import { ProjectStatusAgentProvider } from "~/contexts/project-status-agent-context";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { BottomTabBar } from "../navigation/BottomTabBar";
import { TopNavigation } from "../navigation/TopNavigation";
import { useOnboarding } from "../onboarding";
import { AIAssistantPanel } from "./AIAssistantPanel";

interface AccountRecord {
	account_id: string;
	name?: string | null;
	personal_account?: boolean | null;
	projects?: Array<{
		id: string;
		account_id: string;
		name?: string | null;
		slug?: string | null;
	}> | null;
}

interface ProtectedLayoutData {
	accounts?: AccountRecord[] | null;
	user_settings?: {
		last_used_account_id?: string | null;
		last_used_project_id?: string | null;
	} | null;
}

interface LegacyFloatingPanelLayoutProps {
	systemContext?: string;
	showJourneyNav?: boolean;
}

export function LegacyFloatingPanelLayout({
	systemContext = "",
	showJourneyNav = true,
}: LegacyFloatingPanelLayoutProps) {
	const { isMobile } = useDeviceDetection();
	const [searchParams] = useSearchParams();
	const { accountId, projectId } = useCurrentProject();
	const routes = useProjectRoutesFromIds(accountId, projectId);
	const protectedData = useRouteLoaderData("routes/_ProtectedLayout") as ProtectedLayoutData | null;
	const { aiContext: onboardingContext } = useOnboarding();

	const combinedSystemContext = [systemContext, onboardingContext].filter(Boolean).join("\n\n");

	const isOnboarding = searchParams.get("onboarding") === "true";
	const isWelcomeFlow = searchParams.get("welcome") === "1";
	const showMainNav = !isOnboarding;
	const showMobileNav = isMobile && showJourneyNav && showMainNav;

	const accounts = protectedData?.accounts?.filter(Boolean) ?? [];

	const [isAIPanelOpen, setIsAIPanelOpen] = useState(true);

	useEffect(() => {
		if (isWelcomeFlow) {
			setIsAIPanelOpen(false);
		}
	}, [isWelcomeFlow]);

	const [aiPanelWidth, setAIPanelWidth] = useState(440);
	const handleAIPanelWidthChange = useCallback((width: number) => {
		setAIPanelWidth(width);
	}, []);

	const handleAIPanelOpenChange = useCallback((open: boolean) => {
		setIsAIPanelOpen(open);
	}, []);

	const showAIPanel = showMainNav && !isMobile;

	return (
		<SidebarProvider>
			<ProjectStatusAgentProvider>
				<A2UISurfaceProvider>
					<div className="flex min-h-0 w-full flex-1 flex-col">
						{showMainNav && <TopNavigation accounts={accounts} />}

						<LegacyMainContent
							isMobile={isMobile}
							showMobileNav={showMobileNav}
							showAIPanel={showAIPanel}
							isAIPanelOpen={isAIPanelOpen}
							aiPanelWidth={aiPanelWidth}
						/>

						{showAIPanel && (
							<AIAssistantPanel
								isOpen={isAIPanelOpen}
								onOpenChange={handleAIPanelOpenChange}
								onWidthChange={handleAIPanelWidthChange}
								accounts={accounts}
								systemContext={combinedSystemContext}
								suppressPersistence={isWelcomeFlow}
							/>
						)}

						{showMobileNav && (
							<BottomTabBar
								routes={{
									chat: routes.projects.assistant(),
									upload: routes.interviews.upload(),
									people: routes.people.index(),
								}}
							/>
						)}
					</div>
				</A2UISurfaceProvider>
			</ProjectStatusAgentProvider>
		</SidebarProvider>
	);
}

function LegacyMainContent({
	isMobile,
	showMobileNav,
	showAIPanel,
	isAIPanelOpen,
	aiPanelWidth,
}: {
	isMobile: boolean;
	showMobileNav: boolean;
	showAIPanel: boolean;
	isAIPanelOpen: boolean;
	aiPanelWidth: number;
}) {
	const a2ui = useA2UISurfaceOptional();
	const location = useLocation();
	const [userNavigatedAway, setUserNavigatedAway] = useState(false);
	const surfaceIdWhenShown = useRef<string | null>(null);

	useEffect(() => {
		if (a2ui?.isActive && surfaceIdWhenShown.current) {
			setUserNavigatedAway(true);
		}
	}, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (a2ui?.isActive && a2ui.surface) {
			const currentId = a2ui.surface.surfaceId;
			if (currentId !== surfaceIdWhenShown.current) {
				surfaceIdWhenShown.current = currentId;
				setUserNavigatedAway(false);
			}
		}
		if (!a2ui?.isActive) {
			surfaceIdWhenShown.current = null;
			setUserNavigatedAway(false);
		}
	}, [a2ui?.isActive, a2ui?.surface, a2ui?.surface?.surfaceId]);

	const showCanvas = !isMobile && a2ui?.isActive && !userNavigatedAway;

	return (
		<main
			className={cn(
				"flex min-h-0 flex-1 flex-col overflow-auto transition-[padding] duration-200",
				showMobileNav ? "pb-[72px]" : ""
			)}
			style={showAIPanel && isAIPanelOpen ? { paddingLeft: aiPanelWidth + 20 } : undefined}
		>
			{showCanvas ? <CanvasPanel /> : <Outlet />}
		</main>
	);
}

export default LegacyFloatingPanelLayout;
