import { Link, NavLink, useLocation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { ThemeToggle } from "~/components/ui/theme-toggle"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { PATHS } from "~/paths"
import { useAuth } from "../../contexts/AuthContext"
import { UserProfile } from "../auth/UserProfile"
import { LogoBrand } from "../branding"

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

// Define navigation links with proper paths for authenticated users
export const projectNavLinks: { key: keyof typeof PATHS; label: string; authOnly: boolean }[] = [
	{ key: "PROJECTS", label: "Projects", authOnly: true },
	{ key: "DASHBOARD", label: "Dashboard", authOnly: true },
	{ key: "INTERVIEWS", label: "Interviews", authOnly: true },
	{ key: "INSIGHTS", label: "Insights", authOnly: true },
	{ key: "THEMES", label: "Themes", authOnly: true },
	{ key: "PERSONAS", label: "Personas", authOnly: true },
	// { key: "OPPORTUNITIES", label: "Opportunities", authOnly: true, link: `${PATHS.OPPORTUNITIES}` },
	{ key: "PEOPLE", label: "People", authOnly: true },
	// { key: "AUTO_INSIGHTS", label: "Auto-Takeaways", authOnly: true },
	// { key: "ABOUT", label: "About", authOnly: false, link: `/about` },
	// { key: "THEMES", label: "Themes", authOnly: true, link: `${PATHS.THEMES}` },
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

export default function MainNav({ links }: { links?: { key: string; label: string; authOnly: boolean }[] }) {
	const { user } = useAuth()
	const { pathname } = useLocation()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const isHomePage = pathname === "/"
	const isAboutPage = pathname === "/about"

	// Use provided links or default to projectNavLinks
	const navigationLinks = links || projectNavLinks

	// Public marketing links for non-authenticated users
	const marketingLinks = [
		{ key: "features", label: "Features", link: "#features" },
		{ key: "about", label: "About", link: "/about" },
	]

	return (
		<>
			<nav className={`${isHomePage || isAboutPage ? "border-b bg-white" : "bg-white shadow-sm"} dark:bg-gray-800`}>
				<div className="mx-auto max-w-[1440px] px-4">
					<div className="flex h-16 items-center justify-between">
						{/* Brand - Link to dashboard for authenticated users, home for others */}
						<Link to={user ? routes.home() : routes.login()} className="flex items-center">
							<LogoBrand />
							{/* <span className="ml-2 font-bold text-gray-900 text-xl dark:text-white">Insights</span> */}
						</Link>

						{/* Primary Nav: show appropriate links based on authentication status and page context */}
						<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
							{user && !isHomePage && !isAboutPage
								? // Show project-specific links for authenticated users in app
									navigationLinks
										.filter((item) => item.authOnly && accountId && projectId)
										.map(({ key, label }) => {
											// Generate route based on key
											const routeMap: Record<string, string> = {
												DASHBOARD: routes.dashboard(),
												INTERVIEWS: routes.interviews.index(),
												INSIGHTS: routes.insights.index(),
												THEMES: routes.themes.index(),
												PERSONAS: routes.personas.index(),
												PEOPLE: routes.people.index(),
												PROJECTS: routes.projects.index(),
												OPPORTUNITIES: routes.opportunities.index(),
												AUTO_INSIGHTS: routes.insights.autoInsights(),
											}
											const link = routeMap[key] || "#"

											return (
												<NavLink
													key={key}
													to={link}
													className={({ isActive }) =>
														`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
															isActive
																? "border-blue-500 text-gray-900 dark:text-white"
																: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
														}`
													}
												>
													{label}
												</NavLink>
											)
										})
								: (isHomePage || isAboutPage) && !user
									? // Show marketing links for non-authenticated users on marketing pages
										marketingLinks.map(({ key, label, link }) => (
											<Link
												key={key}
												to={link}
												className="font-medium text-gray-500 text-sm underline-offset-4 hover:text-gray-700 hover:underline"
											>
												{label}
											</Link>
										))
									: null}
						</div>

						{/* Actions: show appropriate buttons based on auth state and page context */}
						<div className="flex items-center space-x-2">
							<ThemeToggle />
							{user ? (
								isHomePage || isAboutPage ? (
									// Show green Dashboard button on marketing pages for authenticated users
									<Button asChild className="bg-green-600 hover:bg-green-700">
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
