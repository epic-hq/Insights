/**
 * BottomTabBar - Mobile bottom navigation
 *
 * 5-tab bottom navigation aligned with TopNavigation categories.
 * Tabs: Plan | Sources | AI (center) | Insights | CRM
 * Includes safe area padding for notched devices.
 */

import {
  Compass,
  Lightbulb,
  Plus,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { cn } from "~/lib/utils";

export interface BottomTabBarProps {
  /** Route helpers for navigation */
  routes: {
    plan: string;
    sources: string;
    chat: string;
    insights: string;
    crm: string;
    upload: string;
  };
  /** Additional CSS classes */
  className?: string;
}

interface TabItemProps {
  to?: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  isCenter?: boolean;
  hasNotification?: boolean;
  isDisabled?: boolean;
}

function TabItem({
  to,
  icon,
  label,
  isActive,
  onClick,
  isCenter,
  hasNotification,
  isDisabled,
}: TabItemProps) {
  const baseClasses = cn(
    "flex min-h-[48px] min-w-[48px] flex-1 flex-col items-center justify-center gap-1",
    "text-muted-foreground transition-colors",
    isActive && "text-primary",
    !isCenter && "hover:text-foreground",
    isDisabled && "cursor-not-allowed opacity-50",
  );

  const content = (
    <>
      {isCenter ? (
        <div
          className={cn(
            "relative flex items-center justify-center",
            "-mt-5 h-14 w-14 rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "transition-all hover:bg-primary/90 active:scale-95",
          )}
        >
          {icon}
          {hasNotification && (
            <span className="-top-1 -right-1 absolute h-3 w-3 rounded-full border-2 border-background bg-destructive" />
          )}
        </div>
      ) : (
        <div className="relative">{icon}</div>
      )}
      <span className={cn("font-medium text-[10px]", isCenter && "mt-1")}>
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={baseClasses} onClick={onClick}>
        {content}
      </button>
    );
  }

  if (to) {
    return (
      <NavLink
        to={to}
        className={({ isActive: navActive }) =>
          cn(baseClasses, navActive && "text-primary")
        }
      >
        {content}
      </NavLink>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export function BottomTabBar({ routes, className }: BottomTabBarProps) {
  const location = useLocation();

  // Check active states
  const isPlanActive =
    location.pathname.includes("/setup") ||
    location.pathname.includes("/questions") ||
    location.pathname.includes("/journey");
  const isSourcesActive =
    location.pathname.includes("/interviews") ||
    location.pathname.includes("/sources") ||
    location.pathname.includes("/responses");
  const isChatActive =
    location.pathname.includes("/project-chat") ||
    location.pathname.includes("/assistant");
  const isInsightsActive =
    location.pathname.includes("/insights") ||
    location.pathname.includes("/lenses");
  const isCrmActive =
    location.pathname.includes("/people") ||
    location.pathname.includes("/organizations") ||
    location.pathname.includes("/opportunities") ||
    location.pathname.includes("/priorities");
  const isUploadActive = location.pathname.includes("/interviews/upload");

  return (
    <>
      {/* Floating Action Button (Upload) */}
      {!isUploadActive && (
        <NavLink
          to={routes.upload}
          aria-label="Add"
          className={cn(
            "fixed right-4 z-[60]",
            "bottom-[calc(env(safe-area-inset-bottom)+84px)]",
            "inline-flex h-12 w-12 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg",
            "transition-all hover:bg-primary/90 active:scale-95",
          )}
        >
          <Plus className="h-6 w-6" />
        </NavLink>
      )}

      <nav
        className={cn(
          "fixed right-0 bottom-0 left-0 z-50",
          "border-border border-t bg-background/95 backdrop-blur-xl",
          "pb-[env(safe-area-inset-bottom)]",
          className,
        )}
      >
        <div className="flex items-end justify-around px-2 py-1">
          {/* Plan */}
          <TabItem
            to={routes.plan}
            icon={<Compass className="h-5 w-5" />}
            label="Plan"
            isActive={isPlanActive}
          />

          {/* Sources */}
          <TabItem
            to={routes.sources}
            icon={<Upload className="h-5 w-5" />}
            label="Sources"
            isActive={isSourcesActive}
          />

          {/* AI Chat (Center) */}
          <TabItem
            to={routes.chat}
            icon={<Sparkles className="h-5 w-5" />}
            label="AI"
            isCenter
            isActive={isChatActive}
          />

          {/* Insights */}
          <TabItem
            to={routes.insights}
            icon={<Lightbulb className="h-5 w-5" />}
            label="Insights"
            isActive={isInsightsActive}
          />

          {/* CRM */}
          <TabItem
            to={routes.crm}
            icon={<Users className="h-5 w-5" />}
            label="CRM"
            isActive={isCrmActive}
          />
        </div>
      </nav>
    </>
  );
}

export default BottomTabBar;
