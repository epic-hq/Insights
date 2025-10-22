import { useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { Button } from "~/components/ui/button"
import { useAuth } from "~/contexts/AuthContext"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { PATHS } from "~/paths"
import { UserProfile } from "../auth/UserProfile"
import { LogoBrand } from "../branding"
import { AppSidebar } from "./AppSidebar"

const marketingLinks = [
	{ key: "benefits", label: "Why", link: "/#benefits" },
	{ key: "features", label: "Features", link: "/#features" },
	// { key: "case-studies", label: "Case Studies", link: "/case-studies" },
	{ key: "blog", label: "Learn", link: "/blog" },
]

export default function MainNav() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const { user } = useAuth()
	const { pathname } = useLocation()
	const { accountId, projectId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const hasProjectContext = Boolean(accountId && projectId)
	const dashboardLink = hasProjectContext ? routes.dashboard() : PATHS.HOME
	const isHomePage = pathname === "/"
	const isAboutPage = pathname === "/about"
	const isBlogPage = pathname.startsWith("/blog")
	const isCaseStudiesPage = pathname.startsWith("/case-studies")
	const isMarketingPage = !user || isHomePage || isAboutPage || isBlogPage || isCaseStudiesPage

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

					{(isHomePage || isAboutPage || isBlogPage || isCaseStudiesPage) && !user && (
						<>
							{/* Desktop Navigation */}
							<div className="hidden md:flex md:space-x-8">
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

							{/* Mobile Menu Button */}
							<div className="md:hidden">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
									aria-label="Toggle mobile menu"
								>
									{mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
				{mobileMenuOpen && (isHomePage || isAboutPage || isBlogPage || isCaseStudiesPage) && !user && (
					<div className="fixed inset-0 z-50 md:hidden">
						{/* Backdrop */}
						<div 
							className="absolute inset-0 bg-black/50" 
							onClick={() => setMobileMenuOpen(false)}
						/>
						
						{/* Menu Panel */}
						<div className="absolute top-0 right-0 h-full w-80 bg-white shadow-xl">
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
										className="block rounded-lg px-4 py-3 font-medium text-gray-700 text-lg hover:bg-gray-100 hover:text-gray-900"
										onClick={() => setMobileMenuOpen(false)}
									>
										{label}
									</NavLink>
								))}
								
								<div className="border-t pt-4">
									<Button asChild variant="ghost" className="justify-start text-lg w-full">
										<Link to={routes.login()} onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
									</Button>
									<Button asChild className="mt-2 text-lg w-full">
										<Link to={routes.register()} onClick={() => setMobileMenuOpen(false)}>Sign Up</Link>
									</Button>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</nav>
	)
}
