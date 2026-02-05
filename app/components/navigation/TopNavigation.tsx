/**
 * TopNavigation - Horizontal top navigation bar
 *
 * Features:
 * - Horizontal nav with mega-menu dropdowns
 * - Plan, Sources, Insights, CRM categories
 * - User profile and search on right side
 * - Responsive: collapses to hamburger on mobile
 */

import { Menu, Search, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { useProjectRoutesFromIds } from "~/hooks/useProjectRoutes";
import { useSidebarCounts } from "~/hooks/useSidebarCounts";
import { cn } from "~/lib/utils";
import { UserProfile } from "../auth/UserProfile";
import { Logo, LogoBrand } from "../branding";
import { TeamSwitcher } from "./TeamSwitcher";
import {
  TOP_NAV_CATEGORIES,
  type TopNavCategory,
  type TopNavItem,
} from "./top-nav.config";

interface TopNavigationProps {
  /** Accounts for team switcher */
  accounts?: Array<{
    account_id: string;
    name?: string | null;
    personal_account?: boolean | null;
  }>;
  /** Callback to toggle AI panel */
  onToggleAIPanel?: () => void;
  /** Whether AI panel is open */
  isAIPanelOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface NavDropdownProps {
  category: TopNavCategory;
  routes: ReturnType<typeof useProjectRoutes>;
  counts: Record<string, number | undefined>;
  isActive: boolean;
}

function NavDropdown({ category, routes, counts, isActive }: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-3 py-2 font-medium text-sm transition-colors",
            "hover:text-foreground focus:outline-none",
            isActive ? "text-primary" : "text-foreground/70",
            open && "text-foreground",
          )}
        >
          <category.icon className="h-4 w-4" />
          {category.title}
          <svg
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {category.description}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {category.items.map((item) => {
          const href = item.to(routes);
          const countValue = item.countKey ? counts[item.countKey] : undefined;

          return (
            <DropdownMenuItem key={item.key} asChild>
              <NavLink
                to={href}
                className="flex items-start gap-3 p-2"
                onClick={() => setOpen(false)}
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-1 flex-col">
                  <span className="font-medium text-sm">{item.title}</span>
                  {item.description && (
                    <span className="text-muted-foreground text-xs">
                      {item.description}
                    </span>
                  )}
                </div>
                {typeof countValue === "number" && countValue > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {countValue}
                  </Badge>
                )}
              </NavLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavItem({
  item,
  routes,
  onClose,
}: {
  item: TopNavItem;
  routes: ReturnType<typeof useProjectRoutes>;
  onClose: () => void;
}) {
  const href = item.to(routes);
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
      onClick={onClose}
    >
      <item.icon className="h-5 w-5" />
      <span>{item.title}</span>
    </NavLink>
  );
}

export function TopNavigation({
  accounts = [],
  onToggleAIPanel,
  isAIPanelOpen,
  className,
}: TopNavigationProps) {
  const params = useParams();
  const accountId = params.accountId || "";
  const projectId = params.projectId || "";
  const routes = useProjectRoutesFromIds(accountId, projectId);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { counts } = useSidebarCounts(accountId, projectId);

  // Determine which category is active based on current path
  const getActiveCategory = () => {
    const path = location.pathname;
    if (
      path.includes("/setup") ||
      path.includes("/questions") ||
      path.includes("/priorities")
    )
      return "plan";
    if (path.includes("/interviews") || path.includes("/ask")) return "sources";
    if (path.includes("/insights") || path.includes("/lenses"))
      return "insights";
    if (
      path.includes("/people") ||
      path.includes("/organizations") ||
      path.includes("/opportunities")
    )
      return "crm";
    return null;
  };

  const activeCategory = getActiveCategory();

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 flex h-14 items-center border-b bg-background/95 backdrop-blur",
          className,
        )}
      >
        <div className="flex w-full items-center gap-4 px-4">
          {/* Logo */}
          <Link to="/home" className="flex shrink-0 items-center gap-2">
            <div className="hidden md:block">
              <LogoBrand />
            </div>
            <div className="md:hidden">
              <Logo />
            </div>
          </Link>

          {/* Team Switcher (desktop) */}
          <div className="hidden md:block">
            <TeamSwitcher accounts={accounts} collapsed={false} />
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {TOP_NAV_CATEGORIES.map((category) => (
              <NavDropdown
                key={category.key}
                category={category}
                routes={routes}
                counts={counts}
                isActive={activeCategory === category.key}
              />
            ))}
          </nav>

          {/* Right side controls */}
          <div className="flex items-center gap-2 ml-auto">
            {/* AI Panel Toggle (desktop) */}
            <Button
              variant={isAIPanelOpen ? "secondary" : "ghost"}
              size="icon"
              onClick={onToggleAIPanel}
              className="hidden md:flex"
              title="Toggle AI Assistant"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* User Profile (desktop) - avatar only, email shows in dropdown */}
            <div className="hidden md:block">
              <UserProfile collapsed />
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b p-4">
            <div className="flex items-center justify-between">
              <SheetTitle>
                <LogoBrand />
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex flex-col gap-6 p-4">
            {/* Team Switcher */}
            <TeamSwitcher accounts={accounts} collapsed={false} />

            {/* Navigation Categories */}
            {TOP_NAV_CATEGORIES.map((category) => (
              <div key={category.key}>
                <h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                  {category.title}
                </h3>
                <div className="flex flex-col gap-1">
                  {category.items.map((item) => (
                    <MobileNavItem
                      key={item.key}
                      item={item}
                      routes={routes}
                      onClose={() => setMobileMenuOpen(false)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* User Profile at bottom */}
            <div className="mt-auto border-t pt-4">
              <UserProfile />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default TopNavigation;
