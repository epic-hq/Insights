/**
 * AppLayout - Main application layout wrapper
 *
 * Provides:
 * - Desktop: Horizontal top nav + AI panel on left + main content (SplitPaneLayout)
 * - Mobile: Bottom tab bar + hamburger menu
 *
 * Legacy sidebar layout available via ?layout=sidebar URL param for testing.
 */

import { useCallback, useState } from "react";
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
          set?: (options: {
            name: string;
            value: string;
            expires?: number;
            path?: string;
          }) => Promise<void>;
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

  // Profile sheet state
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isOnboarding = searchParams.get("onboarding") === "true";
  const showMainNav = !isOnboarding;

  // Should we show the mobile navigation?
  const showMobileNav = isMobile && showJourneyNav && showMainNav;

  const handleSidebarOpenChange = useCallback(
    (nextOpen: boolean) => {
      setSidebarOpen(nextOpen);
      persistSidebarPreference(nextOpen);
    },
    [persistSidebarPreference],
  );

  // Allow legacy sidebar via URL param for testing
  const forceLegacySidebar = searchParams.get("layout") === "sidebar";

  // Default to new split-pane layout (top nav + AI panel)
  if (!forceLegacySidebar) {
    return <SplitPaneLayout showJourneyNav={showJourneyNav} />;
  }

  // Legacy sidebar layout (accessible via ?layout=sidebar)
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarOpenChange}>
      {showMainNav && !isMobile && <AppSidebar />}
      <SidebarInset>
        <main
          className={cn(
            "flex min-h-screen flex-1 flex-col",
            showMobileNav ? "pb-[72px]" : "",
          )}
        >
          <Outlet />
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
  );
}
