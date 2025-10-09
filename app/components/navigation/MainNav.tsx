import { Link, NavLink, useLocation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { useAuth } from "~/contexts/AuthContext"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { PATHS } from "~/paths"
import { LogoBrand } from "../branding"
import { AppSidebar } from "./AppSidebar"
import { UserProfile } from "../auth/UserProfile"

const marketingLinks = [
	{ key: "benefits", label: "Why", link: "#benefits" },
	{ key: "features", label: "Features", link: "#features" },
]

export default function MainNav() {
	const { user } = useAuth()
	const { pathname } = useLocation()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const hasProjectContext = Boolean(accountId && projectId)
	const dashboardLink = hasProjectContext ? routes.dashboard() : PATHS.HOME
	const isHomePage = pathname === "/"
	const isAboutPage = pathname === "/about"
	const isMarketingPage = !user || isHomePage || isAboutPage

	if (user && !isMarketingPage) {
		return <AppSidebar />
	}

	return (
		<nav>
			<div className="mx-auto max-w-[1440px] px-4">
				<div className="flex h-16 items-center justify-between">
					<Link to={user ? dashboardLink : routes.login()} className="flex items-center">
						<LogoBrand />
					</Link>

					{(isHomePage || isAboutPage) && !user && (
						<div className="hidden sm:flex sm:space-x-8">
							{marketingLinks.map(({ key, label, link }) => (
								<NavLink
									key={key}
									to={link}
									className="font-medium text-gray-500 text-sm underline-offset-4 hover:text-gray-700 hover:underline"
								>
									{label}
								</NavLink>
							))}
						</div>
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
			</div>
		</nav>
	)
}
