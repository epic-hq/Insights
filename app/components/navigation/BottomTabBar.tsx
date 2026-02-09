/**
 * BottomTabBar - Mobile bottom navigation
 *
 * 3-item mobile nav: AI (left) | Upload FAB (center) | People (right)
 * Lean mobile-first design — desktop features accessed via TopNavigation.
 * Includes safe area padding for notched devices.
 */

import { Plus, Sparkles, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { cn } from "~/lib/utils";

export interface BottomTabBarProps {
  /** Route helpers for navigation */
  routes: {
    chat: string;
    upload: string;
    people: string;
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

  const isChatActive =
    location.pathname.includes("/project-chat") ||
    location.pathname.includes("/assistant");
  const isPeopleActive =
    location.pathname.includes("/people") ||
    location.pathname.includes("/organizations");
  const isUploadActive = location.pathname.includes("/interviews/upload");

  return (
    <nav
      className={cn(
        "fixed right-0 bottom-0 left-0 z-50",
        "border-border border-t bg-background/95 backdrop-blur-xl",
        "pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <div className="flex items-end justify-around px-6 py-1">
        {/* AI Chat (left) */}
        <TabItem
          to={routes.chat}
          icon={<Sparkles className="h-5 w-5" />}
          label="AI"
          isActive={isChatActive && !isUploadActive}
        />

        {/* Upload (center, elevated FAB) */}
        <TabItem
          to={routes.upload}
          icon={<Plus className="h-6 w-6" />}
          label="Upload"
          isCenter
          isActive={isUploadActive}
        />

        {/* People (right) */}
        <TabItem
          to={routes.people}
          icon={<Users className="h-5 w-5" />}
          label="People"
          isActive={isPeopleActive}
        />
      </div>
    </nav>
  );
}

export default BottomTabBar;
