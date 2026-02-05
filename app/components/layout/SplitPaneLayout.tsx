/**
 * SplitPaneLayout - New layout with horizontal nav and AI panel
 *
 * Layout structure:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                    Top Navigation Bar                          │
 * ├───────────────────┬─────────────────────────────────────────────┤
 * │   AI Assistant    │                                             │
 * │   Panel           │           Main Content Area                 │
 * │   (Collapsible)   │           (Outlet)                          │
 * │                   │                                             │
 * └───────────────────┴─────────────────────────────────────────────┘
 *
 * Features:
 * - Horizontal top navigation with mega-menu dropdowns
 * - Collapsible AI assistant panel on the left
 * - Main content area that fills remaining space
 * - Mobile: AI panel hidden, hamburger menu for nav
 */

import { useCallback, useEffect, useState } from "react";
import {
  Outlet,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { SidebarProvider } from "~/components/ui/sidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import { cn } from "~/lib/utils";
import { BottomTabBar } from "../navigation/BottomTabBar";
import { ProfileSheet } from "../navigation/ProfileSheet";
import { TopNavigation } from "../navigation/TopNavigation";
import { useOnboarding } from "../onboarding";
import { ProjectStatusAgentProvider } from "~/contexts/project-status-agent-context";
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
  const params = useParams();
  const accountId = params.accountId || "";
  const projectId = params.projectId || "";
  const projectPath =
    accountId && projectId ? `/a/${accountId}/${projectId}` : "";
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

  // AI Panel state - persisted to localStorage
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("ai-panel-open");
    // Default to open for new users
    return stored !== "false";
  });

  // Collapse panel when entering welcome flow (useEffect to avoid stale closure in initializer)
  useEffect(() => {
    if (isWelcomeFlow) {
      setIsAIPanelOpen(false);
    }
  }, [isWelcomeFlow]);

  // Profile sheet state (mobile)
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const showMainNav = !isOnboarding;

  // Should we show the mobile navigation?
  const showMobileNav = isMobile && showJourneyNav && showMainNav;

  const accounts = protectedData?.accounts?.filter(Boolean) ?? [];

  const handleAIPanelToggle = useCallback(() => {
    setIsAIPanelOpen((prev) => !prev);
  }, []);

  const handleAIPanelOpenChange = useCallback((open: boolean) => {
    setIsAIPanelOpen(open);
  }, []);

  // Whether to show the resizable AI panel (desktop + nav visible + panel expanded)
  const showResizablePanel = showMainNav && !isMobile && isAIPanelOpen;
  // Collapsed icon strip (desktop + nav visible + panel collapsed)
  const showCollapsedPanel = showMainNav && !isMobile && !isAIPanelOpen;

  return (
    <SidebarProvider>
      <ProjectStatusAgentProvider>
        <div className="flex h-screen w-full flex-col">
          {/* Top Navigation - hidden on mobile, shown on desktop */}
          {showMainNav && !isMobile && <TopNavigation accounts={accounts} />}

          {/* Main content area with AI panel */}
          {showResizablePanel ? (
            <ResizablePanelGroup
              direction="horizontal"
              className="min-h-0 flex-1"
              autoSaveId="ai-panel-layout"
            >
              {/* AI Assistant Panel — resizable */}
              <ResizablePanel
                defaultSize={22}
                minSize={15}
                maxSize={45}
                order={1}
              >
                <AIAssistantPanel
                  isOpen={isAIPanelOpen}
                  onOpenChange={handleAIPanelOpenChange}
                  accounts={accounts}
                  systemContext={combinedSystemContext}
                  suppressPersistence={isWelcomeFlow}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Main content */}
              <ResizablePanel defaultSize={78} order={2}>
                <main
                  className={cn(
                    "flex h-full min-h-0 flex-col overflow-auto",
                    showMobileNav ? "pb-[72px]" : "",
                  )}
                >
                  <Outlet />
                </main>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            <div className="flex min-h-0 flex-1">
              {/* Collapsed AI panel icon strip */}
              {showCollapsedPanel && (
                <AIAssistantPanel
                  isOpen={isAIPanelOpen}
                  onOpenChange={handleAIPanelOpenChange}
                  accounts={accounts}
                  systemContext={combinedSystemContext}
                  suppressPersistence={isWelcomeFlow}
                />
              )}

              {/* Main content */}
              <main
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-auto",
                  showMobileNav ? "pb-[72px]" : "",
                )}
              >
                <Outlet />
              </main>
            </div>
          )}

          {/* Mobile Bottom Tab Bar */}
          {showMobileNav && (
            <BottomTabBar
              routes={{
                dashboard: routes.projects.dashboard(),
                contacts: routes.people.index(),
                content: routes.interviews.index(),
                chat: routes.projects.projectChat(),
                insights: routes.insights.cards(),
                upload: routes.interviews.upload(),
              }}
              onProfileClick={() => setIsProfileOpen(true)}
            />
          )}

          {/* Profile Sheet (mobile) */}
          {isMobile && (
            <ProfileSheet
              open={isProfileOpen}
              onOpenChange={setIsProfileOpen}
              accountSettingsHref={`/a/${accountId}/settings`}
            />
          )}
        </div>
      </ProjectStatusAgentProvider>
    </SidebarProvider>
  );
}

export default SplitPaneLayout;
