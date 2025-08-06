import React from "react"
import { Link } from "react-router-dom"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { PATHS } from "~/paths"
import Breadcrumbs from "./Breadcrumbs"

interface BreadcrumbItem {
	label: string
	path: string
}

interface PageHeaderProps {
	title: string
	showBreadcrumbs?: boolean
	breadcrumbs?: BreadcrumbItem[]
	className?: string
}

const PageHeader: React.FC<PageHeaderProps> = ({ title = "", showBreadcrumbs = true, breadcrumbs, className = "" }) => {
	const { projectPath } = useCurrentProject()
	const _routes = useProjectRoutes(projectPath || "")

	return (
		<header className={`mx-auto max-w-[1440px] px-4 py-2 ${className}`}>
			<div className="">
				{/* Only show back link if breadcrumbs are hidden */}
				{!showBreadcrumbs && (
					<Link to={PATHS.DASHBOARD} className="mb-4 flex items-center text-blue-600 hover:text-blue-800">
						<svg
							className="mr-1 h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
						</svg>
						Back to Dashboard
					</Link>
				)}

				{showBreadcrumbs &&
					(breadcrumbs ? (
						<div className="mb-4 flex items-center text-sm">
							{breadcrumbs.map((item, index) => (
								<React.Fragment key={item.path}>
									{index > 0 && <span className="mx-2 text-gray-400">/</span>}
									{index === breadcrumbs.length - 1 ? (
										<span className="text-gray-600">{item.label}</span>
									) : (
										<Link to={item.path} className="text-blue-600 hover:text-blue-800">
											{item.label}
										</Link>
									)}
								</React.Fragment>
							))}
						</div>
					) : (
						<Breadcrumbs className="mb-4" />
					))}

				{/* {title && <h1 className="font-bold text-2xl">{title}</h1>} */}
			</div>
		</header>
	)
}

export default PageHeader
