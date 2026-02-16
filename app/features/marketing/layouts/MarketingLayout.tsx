import { Outlet } from "react-router";
import MarketingNav from "~/components/navigation/MarketingNav";

/**
 * Marketing Layout
 * Shared layout for blog, case studies, pricing, and other marketing pages
 * Includes MarketingNav header - child pages control their own backgrounds
 */
export default function MarketingLayout() {
	return (
		<div className="min-h-screen">
			<MarketingNav />
			<Outlet />
		</div>
	);
}
