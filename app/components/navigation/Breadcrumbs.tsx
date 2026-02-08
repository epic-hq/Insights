import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { z } from "zod";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";

interface BreadcrumbsProps {
	className?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = "" }) => {
	const currentProjectContext = useCurrentProject();
	const routes = useProjectRoutes(currentProjectContext?.projectPath);
	const location = useLocation();
	const pathnames = location.pathname.split("/").filter((x) => x);

	// Map of route segments to display names
	const routeLabels: Record<string, string> = {
		interviews: "Interviews",
		insights: "Insights",
		opportunities: "Opportunities",
		personas: "Personas",
		skeptics: "Skeptics",
		people: "People",
		projects: "Projects",
		dashboard: "Dashboard",
		new: "New",
		edit: "Edit",
		table: "Table",
		"auto-insights": "Auto Insights",
	};

	// Filter out unwanted segments (UUIDs, account paths, etc.)
	const filteredPathnames = pathnames.filter((segment) => {
		// Skip if it's a UUID
		if (z.string().uuid().safeParse(segment).success) {
			return false;
		}
		// Skip account path segments (single letter followed by nothing meaningful)
		if (segment === "a" || segment === "p") {
			return false;
		}
		// Skip empty or very short meaningless segments
		if (segment.length <= 1) {
			return false;
		}
		// Only include known route segments or meaningful paths
		return routeLabels[segment] || segment.length > 2;
	});

	return (
		<nav className={`flex ${className}`} aria-label="Breadcrumb">
			<ol className="inline-flex items-center space-x-1 md:space-x-3">
				<li className="inline-flex items-center">
					<Link
						to={routes.dashboard()}
						className="inline-flex items-center font-medium text-gray-700 text-sm hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
					>
						<svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
							<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
						</svg>
					</Link>
				</li>

				{filteredPathnames
					.map((name, index) => {
						// Build the route using filtered segments up to current index
						const originalIndex = pathnames.indexOf(name);
						const routeTo = `/${pathnames.slice(0, originalIndex + 1).join("/")}`;
						const isLast = index === filteredPathnames.length - 1;
						const displayName = routeLabels[name] || name;

						// Skip rendering if no display name
						if (!displayName) {
							return null;
						}

						return (
							<li key={`breadcrumb-${name}-${originalIndex}`}>
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
						);
					})
					.filter(Boolean)}
			</ol>
		</nav>
	);
};

export default Breadcrumbs;
