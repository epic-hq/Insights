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

import { useCallback, useEffect, useState } from "react";
import { Outlet, useRouteLoaderData, useSearchParams } from "react-router";
import { SidebarProvider } from "~/components/ui/sidebar";
import { useCurrentProject } from "~/contexts/current-project-context";
import { ProjectStatusAgentProvider } from "~/contexts/project-status-agent-context";
import { useDeviceDetection } from "~/hooks/useDeviceDetection";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { BottomTabBar } from "../navigation/BottomTabBar";
import { ProfileSheet } from "../navigation/ProfileSheet";
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

  // AI Panel state - persisted to localStorage
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("ai-panel-open");
    // Default to closed so floating button is visible first
    return stored === "true";
  });

  // Collapse panel when entering welcome flow
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

  const handleAIPanelOpenChange = useCallback((open: boolean) => {
    setIsAIPanelOpen(open);
  }, []);

  // Show AI panel on desktop when nav is visible
  const showAIPanel = showMainNav && !isMobile;

  return (
    <SidebarProvider>
      <ProjectStatusAgentProvider>
        <div className="flex min-h-0 w-full flex-1 flex-col">
          {/* Top Navigation - hidden on mobile, shown on desktop */}
          {showMainNav && !isMobile && <TopNavigation accounts={accounts} />}

          {/* Main content - always full width */}
          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-auto",
              showMobileNav ? "pb-[72px]" : "",
            )}
          >
            <Outlet />
          </main>

          {/* Floating AI Assistant (outside layout flow) */}
          {showAIPanel && (
            <AIAssistantPanel
              isOpen={isAIPanelOpen}
              onOpenChange={handleAIPanelOpenChange}
              accounts={accounts}
              systemContext={combinedSystemContext}
              suppressPersistence={isWelcomeFlow}
            />
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
