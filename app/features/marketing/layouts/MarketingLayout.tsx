import { Outlet } from "react-router"
import MainNav from "~/components/navigation/MainNav"

/**
 * Marketing Layout
 * Shared layout for blog, case studies, and other marketing pages
 * Includes MainNav header and consistent styling
 */
export default function MarketingLayout() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
			<MainNav />
			<Outlet />
		</div>
	)
}
