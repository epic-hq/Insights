/**
 * SplitPaneLayout - Main app layout with floating AI assistant
 *
 * Layout structure:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Top Navigation Bar                          │
 * ├───────────────────────────────────────────────────────────────────┤
 * │                                                                 │
 * │                    Main Content Area                            │
 * │                    (Full width, Outlet)                         │
 * │                                                                 │
 * │  ┌──────────────┐                                              │
 * │  │ AI Assistant  │  ← Floating overlay (bottom-left)           │
 * │  │ Panel         │                                              │
 * │  └──────────────┘                                              │
 * └───────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Horizontal top navigation with mega-menu dropdowns
 * - Floating AI assistant (prominent button → overlay panel)
 * - Main content takes full width
 * - Mobile: AI panel hidden, hamburger menu for nav
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Outlet,
  useLocation,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { SidebarProvider } from "~/components/ui/sidebar";
import { CanvasPanel } from "~/components/gen-ui/CanvasPanel";
import { A2UISurfaceProvider } from "~/contexts/a2ui-surface-context";
import { useA2UISurfaceOptional } from "~/contexts/a2ui-surface-context";
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

interface SplitPaneLayoutProps {
  /** System context for AI chat */
  systemContext?: string;
  /** Whether to show the journey navigation (onboarding) */
  showJourneyNav?: boolean;
}

export function SplitPaneLayout({
  systemContext = "",
  showJourneyNav = true,
}: SplitPaneLayoutProps) {
  const { isMobile } = useDeviceDetection();
  const [searchParams] = useSearchParams();
  const { accountId, projectId } = useCurrentProject();
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const protectedData = useRouteLoaderData(
    "routes/_ProtectedLayout",
  ) as ProtectedLayoutData | null;
  const { aiContext: onboardingContext } = useOnboarding();

  // Combine system context with onboarding context for personalized AI
  const combinedSystemContext = [systemContext, onboardingContext]
    .filter(Boolean)
    .join("\n\n");

  const isOnboarding = searchParams.get("onboarding") === "true";
  const isWelcomeFlow = searchParams.get("welcome") === "1";

  // AI Panel state - persisted to localStorage.
  // Always start false to match SSR, then sync from localStorage in useEffect.
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ai-panel-open");
    if (stored === "true") setIsAIPanelOpen(true);
  }, []);

  // Collapse panel when entering welcome flow
  useEffect(() => {
    if (isWelcomeFlow) {
      setIsAIPanelOpen(false);
    }
  }, [isWelcomeFlow]);

  const showMainNav = !isOnboarding;

  // Should we show the mobile navigation?
  const showMobileNav = isMobile && showJourneyNav && showMainNav;

  const accounts = protectedData?.accounts?.filter(Boolean) ?? [];

  // Track AI panel width for dynamic content padding
  const [aiPanelWidth, setAIPanelWidth] = useState(440);
  const handleAIPanelWidthChange = useCallback((width: number) => {
    setAIPanelWidth(width);
  }, []);

  const handleAIPanelOpenChange = useCallback((open: boolean) => {
    setIsAIPanelOpen(open);
  }, []);

  // Show AI panel on desktop when nav is visible
  const showAIPanel = showMainNav && !isMobile;

  return (
    <SidebarProvider>
      <ProjectStatusAgentProvider>
        <A2UISurfaceProvider>
          <div className="flex min-h-0 w-full flex-1 flex-col">
            {/* Top Navigation - shown on both desktop and mobile */}
            {showMainNav && <TopNavigation accounts={accounts} />}

            {/* Main content - shifts right when AI panel is expanded */}
            <MainContent
              isMobile={isMobile}
              showMobileNav={showMobileNav}
              showAIPanel={showAIPanel}
              isAIPanelOpen={isAIPanelOpen}
              aiPanelWidth={aiPanelWidth}
            />

            {/* Floating AI Assistant (outside layout flow) */}
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

            {/* Mobile Bottom Tab Bar */}
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

/**
 * MainContent - Handles display context switching between canvas and outlet.
 *
 * When the agent has an active surface AND the user hasn't navigated away,
 * the canvas replaces the outlet. Navigating via sidebar/nav restores the
 * outlet and preserves canvas state for "return to canvas" in chat.
 */
function MainContent({
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

  // When route changes while canvas is active, user navigated away
  useEffect(() => {
    if (a2ui?.isActive && surfaceIdWhenShown.current) {
      setUserNavigatedAway(true);
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a new surface arrives (or first surface), show canvas
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

  // Desktop: show canvas when active and user hasn't navigated away
  const showCanvas = !isMobile && a2ui?.isActive && !userNavigatedAway;

  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-auto transition-[padding] duration-200",
        showMobileNav ? "pb-[72px]" : "",
      )}
      style={
        showAIPanel && isAIPanelOpen
          ? { paddingLeft: aiPanelWidth + 20 }
          : undefined
      }
    >
      {showCanvas ? <CanvasPanel /> : <Outlet />}
    </main>
  );
}

export default SplitPaneLayout;
