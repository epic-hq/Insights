import { Link, NavLink, useLocation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { PATHS } from "~/paths"
import { useAuth } from "../../contexts/AuthContext"
import { UserProfile } from "../auth/UserProfile"
import { LogoBrand } from "../branding"
import { JourneyNav } from "./JourneyNav"

// export const projectNavLinks: { key: keyof typeof PATHS; label: string; authOnly: boolean }[] = [
// 	{ key: "DASHBOARD", label: "Dashboard", authOnly: true },
// 	{ key: "INTERVIEWS", label: "Interviews", authOnly: true },
// 	{ key: "INSIGHTS", label: "Insights", authOnly: true },
// 	{ key: "PERSONAS", label: "Personas", authOnly: true },
// 	// { key: "OPPORTUNITIES", label: "Opportunities", authOnly: true },
// 	{ key: "PEOPLE", label: "People", authOnly: true },
// 	{ key: "PROJECTS", label: "Projects", authOnly: true },
// 	{ key: "AUTO_INSIGHTS", label: "Auto-Takeaways", authOnly: true },
// 	// { key: "ABOUT", label: "About", authOnly: false },
// 	// { key: "THEMES", label: "Themes", authOnly: true },
// ]

// Legacy navigation links - now handled by JourneyNav
// Keeping for backward compatibility and non-journey pages
export const projectNavLinks: { key: keyof typeof PATHS; label: string; authOnly: boolean }[] = [
	// Main journey navigation is now handled by JourneyNav component
	// These are kept for any standalone pages or admin functions
]

function _Breadcrumbs() {
	const { user } = useAuth()
	const { pathname } = useLocation()
	const segments = pathname.split("/").filter(Boolean)

	if (!user || segments.length === 0) return null

	return (
		<nav className="bg-gray-100 dark:bg-gray-700" aria-label="breadcrumb">
			<div className="mx-auto max-w-[1440px] px-4 py-2 text-gray-600 text-sm dark:text-gray-300">
				{segments.map((seg, idx) => {
					const path = `/${segments.slice(0, idx + 1).join("/")}`
					const label = seg[0].toUpperCase() + seg.slice(1)
					return (
						<span key={path} className="inline-flex items-center">
							{idx > 0 && <span className="mx-1">/</span>}
							<NavLink to={path} className="hover:underline">
								{label}
							</NavLink>
						</span>
					)
				})}
			</div>
		</nav>
	)
}

export default function MainNav() {
	const { user } = useAuth()
	const { pathname } = useLocation()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const isHomePage = pathname === "/"
	const isAboutPage = pathname === "/about"

	// Note: navigationLinks removed as JourneyNav now handles primary navigation

	// Public marketing links for non-authenticated users
	const marketingLinks = [
		{ key: "benefits", label: "Why", link: "#benefits" },
		{ key: "features", label: "Features", link: "#features" },
	]

	return (
		<>
			<nav className={`${isHomePage || isAboutPage ? "" : ""}`}>
				<div className="mx-auto max-w-[1440px] px-4">
					<div className="flex h-16 items-center justify-between">
						{/* Brand - Link to dashboard for authenticated users, home for others */}
						<Link to={user ? routes.home() : routes.login()} className="flex items-center">
							<LogoBrand />
							{/* <span className="ml-2 font-bold text-gray-900 text-xl dark:text-white">Insights</span> */}
						</Link>

						{/* Journey Navigation - show for authenticated users in app on desktop only */}
						<div className="flex flex-1 justify-center">
							{user && !isHomePage && !isAboutPage && accountId && projectId && (
								<div className="hidden md:block">
									<JourneyNav variant="stepper" className="flex items-center" />
								</div>
							)}
							{/* Marketing links for non-authenticated users on marketing pages */}
							{(isHomePage || isAboutPage) && !user && (
								<div className="hidden sm:flex sm:space-x-8">
									{marketingLinks.map(({ key, label, link }) => (
										<Link
											key={key}
											to={link}
											className="font-medium text-gray-500 text-sm underline-offset-4 hover:text-gray-700 hover:underline"
										>
											{label}
										</Link>
									))}
								</div>
							)}
						</div>

						{/* Actions: show appropriate buttons based on auth state and page context */}
						<div className="flex items-center space-x-2">
							{/* Show theme toggle only for authenticated users */}

							{user ? (
								isHomePage || isAboutPage ? (
									// Show Dashboard button on marketing pages for authenticated users
									<Button asChild>
										<Link to={routes.home()}>Dashboard</Link>
									</Button>
								) : (
									// Show user profile in app pages
									<UserProfile />
								)
							) : (
								// Show sign in/up buttons for non-authenticated users
								<>
									<Button asChild variant="ghost">
										<Link to={PATHS.AUTH.LOGIN}>Sign In</Link>
									</Button>
									<Button asChild>
										<Link to={PATHS.AUTH.REGISTER}>Sign Up</Link>
									</Button>
								</>
							)}
						</div>
					</div>
				</div>
			</nav>

			{/* Breadcrumbs: only show on main routes */}
			{/* {user && isMainRoute && <Breadcrumbs />} */}
		</>
	)
}
