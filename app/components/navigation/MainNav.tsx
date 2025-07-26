import { Link, NavLink, useLocation } from "react-router-dom"
import { PATHS } from "~/paths"
import { useAuth } from "../../contexts/AuthContext"
import { UserProfile } from "../auth/UserProfile"

const navItems = [
	{ to: PATHS.DASHBOARD, label: "Dashboard", authOnly: true },
	{ to: PATHS.INTERVIEWS, label: "Interviews", authOnly: true },
	{ to: PATHS.INSIGHTS, label: "Insights", authOnly: true },
	{ to: PATHS.PERSONAS, label: "Personas", authOnly: true },
	// { to: "/opportunities", label: "Opportunities", authOnly: true },
	{ to: PATHS.PEOPLE, label: "People", authOnly: true },
	{ to: PATHS.PROJECTS, label: "Projects", authOnly: true },
	{ to: PATHS.AUTO_INSIGHTS, label: "Auto-Insights", authOnly: true },
	// { to: PATHS.ABOUT, label: "About", authOnly: false },
	// { to: "/themes", label: "Themes", authOnly: true },
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
	const _isMainRoute =
		pathname !== "/" && /^\/(themes|personas|opportunities|interviews|insights|projects|people|about)/.test(pathname)

	return (
		<>
			<nav className="bg-white shadow-sm dark:bg-gray-800">
				<div className="mx-auto max-w-[1440px] px-4">
					<div className="flex h-16 items-center justify-between">
						{/* Brand */}
						<Link to={PATHS.DASHBOARD} className="flex items-center">
							<svg
								className="lucide lucide-scan-eye-icon h-8 w-8 text-blue-600"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-label="Scan Eye Icon"
							>
								<path d="M3 7V5a2 2 0 0 1 2-2h2" />
								<path d="M17 3h2a2 2 0 0 1 2 2v2" />
								<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
								<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
								<circle cx="12" cy="12" r="1" />
								<path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
							</svg>

							<span className="ml-2 font-bold text-gray-900 text-xl dark:text-white">Insights</span>
						</Link>

						{/* Primary Nav: always visible for authenticated users */}
						{user && (
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								{navItems
									.filter((item) => !item.authOnly || user)
									.map(({ to, label }) => (
										<NavLink
											key={to}
											to={to}
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
									))}
							</div>
						)}

						{/* Actions: show login button or user profile based on auth state */}
						<div className="flex items-center space-x-4">
							{user ? (
								<UserProfile />
							) : (
								<Link
									to={PATHS.AUTH.LOGIN}
									className="rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
								>
									Sign In/Up
								</Link>
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
