import { Link, NavLink } from "react-router-dom"

export default function MainNav() {
	return (
		<nav className="bg-white shadow-sm dark:bg-gray-800">
			<div className="mx-auto max-w-[1440px] px-4">
				<div className="flex h-16 justify-between">
					<div className="flex">
						<div className="flex flex-shrink-0 items-center">
							<Link to="/" className="flex items-center">
								<svg
									className="h-8 w-8 text-blue-600"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									aria-label="Insights Logo"
								>
									<path
										d="M12 2L2 7L12 12L22 7L12 2Z"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M2 17L12 22L22 17"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
									<path
										d="M2 12L12 17L22 12"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								<span className="ml-2 font-bold text-gray-900 text-xl dark:text-white">Insights</span>
							</Link>
						</div>
						<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
							<NavLink
								to="/"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Dashboard
							</NavLink>
							<NavLink
								to="/themes"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Themes
							</NavLink>
							<NavLink
								to="/personas"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Personas
							</NavLink>
							<NavLink
								to="/opportunities"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Opportunities
							</NavLink>
							<NavLink
								to="/interviews"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Interviews
							</NavLink>
							<NavLink
								to="/insights"
								className={({ isActive }) =>
									`inline-flex items-center border-b-2 px-1 pt-1 font-medium text-sm ${
										isActive
											? "border-blue-500 text-gray-900 dark:text-white"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:text-gray-200"
									}`
								}
							>
								Insights
							</NavLink>
						</div>
					</div>
					<div className="hidden sm:ml-6 sm:flex sm:items-center">
						<Link
							to="/upload"
							className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
						>
							Upload
						</Link>
					</div>
				</div>
			</div>
		</nav>
	)
}
