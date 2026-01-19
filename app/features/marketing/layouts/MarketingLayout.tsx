import { Outlet } from "react-router";
import MainNav from "~/components/navigation/MainNav";

/**
 * Marketing Layout
 * Shared layout for blog, case studies, pricing, and other marketing pages
 * Includes MainNav header - child pages control their own backgrounds
 */
export default function MarketingLayout() {
  return (
    <div className="min-h-screen">
      <MainNav />
      <Outlet />
    </div>
  );
}
