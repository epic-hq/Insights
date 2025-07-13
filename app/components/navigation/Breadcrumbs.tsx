import type React from "react"
import { Link, useLocation } from "react-router-dom"

interface BreadcrumbsProps {
	className?: string
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = "" }) => {
	const location = useLocation()
	const pathnames = location.pathname.split("/").filter((x) => x)

	// Map of route segments to display names
	const routeLabels: Record<string, string> = {
		interviews: "Interviews",
		insights: "Insights",
		opportunities: "Opportunities",
		personas: "Personas",
		"early-adopters": "Early Adopters",
		"mainstream-learners": "Mainstream Learners",
		skeptics: "Skeptics",
	}

	return (
		<nav className={`flex ${className}`} aria-label="Breadcrumb">
			<ol className="inline-flex items-center space-x-1 md:space-x-3">
				<li className="inline-flex items-center">
					<Link
						to="/"
						className="inline-flex items-center font-medium text-gray-700 text-sm hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
					>
						<svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
							<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
						</svg>
						Dashboard
					</Link>
				</li>

				{pathnames.map((name, index) => {
					const routeTo = `/${pathnames.slice(0, index + 1).join("/")}`
					const isLast = index === pathnames.length - 1
					const displayName = routeLabels[name] || name

					return (
						<li key={name}>
							<div className="flex items-center">
								<svg
									className="h-6 w-6 text-gray-400"
									fill="currentColor"
									viewBox="0 0 20 20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path
										fillRule="evenodd"
										d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
										clipRule="evenodd"
									/>
								</svg>
								{isLast ? (
									<span className="ml-1 font-medium text-gray-500 text-sm md:ml-2 dark:text-gray-400">
										{displayName}
									</span>
								) : (
									<Link
										to={routeTo}
										className="ml-1 font-medium text-gray-700 text-sm hover:text-blue-600 md:ml-2 dark:text-gray-400 dark:hover:text-white"
									>
										{displayName}
									</Link>
								)}
							</div>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

export default Breadcrumbs
