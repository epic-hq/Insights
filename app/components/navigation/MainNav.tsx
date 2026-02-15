import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "~/components/ui/button";
import { useAuth } from "~/contexts/AuthContext";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { cn } from "~/lib/utils";
import { PATHS } from "~/paths";
import { UserProfile } from "../auth/UserProfile";
import { LogoBrand } from "../branding";
import { AppSidebar } from "./AppSidebar";

const marketingLinks = [
  {
    key: "product-teams",
    label: "For Product Teams",
    link: "/customer-discovery",
  },
  {
    key: "consultants",
    label: "Consultants",
    link: "/customer-discovery-for-consultants",
  },
  { key: "pricing", label: "Pricing", link: "/pricing" },
  { key: "blog", label: "Blog", link: "/blog" },
];

export default function MainNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { accountId, projectId, projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");

  const hasProjectContext = Boolean(accountId && projectId);
  const dashboardLink = hasProjectContext ? routes.dashboard() : PATHS.HOME;
  const isHomePage = pathname === "/";
  const isAboutPage = pathname === "/about";
  const isBlogPage = pathname.startsWith("/blog");
  const isCaseStudiesPage = pathname.startsWith("/case-studies");
  const isPricingPage = pathname === "/pricing";
  const isCustomerDiscoveryPage = pathname === "/customer-discovery";
  const isCustomerDiscoveryConsultantsPage =
    pathname === "/customer-discovery-for-consultants";
  const isDarkHeroPage =
    isHomePage ||
    isPricingPage ||
    isCustomerDiscoveryPage ||
    isCustomerDiscoveryConsultantsPage;
  const isMarketingPage =
    !user ||
    isHomePage ||
    isAboutPage ||
    isBlogPage ||
    isCaseStudiesPage ||
    isPricingPage ||
    isCustomerDiscoveryPage ||
    isCustomerDiscoveryConsultantsPage;
  const shouldShowMarketingLinks =
    (isHomePage ||
      isAboutPage ||
      isBlogPage ||
      isCaseStudiesPage ||
      isPricingPage ||
      isCustomerDiscoveryPage ||
      isCustomerDiscoveryConsultantsPage) &&
    !user;

  if (user && !isMarketingPage) {
    return <AppSidebar />;
  }

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 w-full",
        isMarketingPage &&
          !isDarkHeroPage &&
          "border-zinc-200/70 border-b bg-white/95 text-zinc-900 backdrop-blur",
        isMarketingPage &&
          isDarkHeroPage &&
          "border-white/10 border-b bg-zinc-950/95 text-white backdrop-blur",
      )}
    >
      <div className="mx-auto max-w-[1440px] px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to={user ? dashboardLink : "/"} className="flex items-center">
            <LogoBrand />
          </Link>

          {shouldShowMarketingLinks && (
            <>
              {/* Desktop Navigation */}
              <div className="hidden md:flex md:space-x-8">
                {marketingLinks.map(({ key, label, link }) => (
                  <NavLink
                    key={key}
                    to={link}
                    className={cn(
                      "font-medium text-sm underline-offset-4 hover:underline",
                      isDarkHeroPage
                        ? "text-zinc-300 hover:text-white"
                        : "text-zinc-700 hover:text-zinc-950",
                    )}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>

              {/* Mobile Menu Button */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle mobile menu"
                >
                  {mobileMenuOpen ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Menu className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </>
          )}

          <div className="flex items-center space-x-2">
            {user ? (
              isMarketingPage ? (
                <Button asChild>
                  <Link to={dashboardLink}>Dashboard</Link>
                </Button>
              ) : (
                <UserProfile />
              )
            ) : (
              <>
                <Button asChild variant="ghost">
                  <Link to={routes.login()}>Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to={routes.register()}>Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && shouldShowMarketingLinks && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-xl dark:bg-zinc-900">
              <div className="flex h-16 items-center justify-between px-4">
                <LogoBrand />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex flex-col space-y-4 p-4">
                {marketingLinks.map(({ key, label, link }) => (
                  <NavLink
                    key={key}
                    to={link}
                    className="block rounded-lg px-4 py-3 font-medium text-gray-700 text-lg hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}

                <div className="border-t pt-4">
                  <Button
                    asChild
                    className="w-full justify-start text-lg"
                    variant="ghost"
                  >
                    <Link
                      onClick={() => setMobileMenuOpen(false)}
                      to={routes.login()}
                    >
                      Sign In
                    </Link>
                  </Button>
                  <Button asChild className="mt-2 w-full text-lg">
                    <Link
                      onClick={() => setMobileMenuOpen(false)}
                      to={routes.register()}
                    >
                      Sign Up
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
