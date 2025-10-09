import { ChevronRight, Command, Lightbulb, Mic, Search, TrendingUp, Users } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { cn } from "~/lib/utils"

export interface JourneyStep {
	key: string
	title: string
	description: string
	icon: React.ComponentType<{ className?: string }>
	routes: string[]
	subItems?: {
		label: string
		route: string
		description?: string
	}[]
}

export const journeySteps: JourneyStep[] = [
	{
		key: "research",
		title: "Research",
		description: "Define goals & get evidence",
		icon: Command,
		routes: ["/dashboard"],
		subItems: [
			{ label: "Status", route: "/dashboard", description: "Project overview & recommendations" },
		],
	},
	{
		key: "interviews",
		title: "Interviews",
		description: "Interview transcripts & evidence collection",
		icon: Mic,
		routes: ["/interviews", "/interviews/new"],
		subItems: [
			{ label: "Interviews", route: "/interviews", description: "Interview transcripts & evidence collection" },
			{ label: "Add Data", route: "/interviews/new", description: "Upload interviews & surveys" },
		],
	},
	{
		key: "personas",
		title: "People",
		description: "Analyze who we're hearing from",
		icon: Users,
		routes: ["/personas", "/people"],
		subItems: [
			{ label: "Personas", route: "/personas", description: "User archetypes & segments" },
			{ label: "People", route: "/people", description: "Interview participants" },
			{ label: "Evidence", route: "/personas/evidence", description: "Supporting quotes & data" },
		],
	},
	{
		key: "patterns",
		title: "Themes",
		description: "See signals, strength & resonance",
		icon: TrendingUp,
		routes: ["/themes"],
		subItems: [
			{ label: "Themes", route: "/themes", description: "Ranked themes with badges" },
			{ label: "Matrix", route: "/themes/matrix", description: "Persona × Theme intersections" },
		],
	},
	{
		key: "insights",
		title: "Insights",
		description: "Explore insights & 'How Might We' next steps",
		icon: Lightbulb,
		routes: ["/insights", "/opportunities"],
		subItems: [
			{ label: "Insights", route: "/insights", description: "Published findings & analysis" },
			{ label: "Opportunities", route: "/opportunities", description: "HMW backlog & experiments" },
			{ label: "Auto-Insights", route: "/insights/auto", description: "AI-generated takeaways" },
		],
	},
]

interface JourneyNavProps {
	variant?: "sidebar" | "bottom" | "stepper"
	className?: string
}

export function JourneyNav({ variant = "sidebar", className }: JourneyNavProps) {
	const location = useLocation()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const getCurrentStep = () => {
		const currentPath = location.pathname
		
		// Extract the route segment after the project path (e.g., /a/123/456/interviews -> /interviews)
		// This handles paths like /a/:accountId/:projectId/interviews
		const pathSegments = currentPath.split('/').filter(Boolean)
		const routeSegment = pathSegments.length >= 3 ? `/${pathSegments.slice(3).join('/')}` : currentPath
		
		// Find the most specific match (longest route that matches)
		let bestMatch: JourneyStep | undefined
		let bestMatchLength = 0
		
		for (const step of journeySteps) {
			// Check direct routes
			for (const route of step.routes) {
				// Match if routeSegment starts with the route pattern
				if (routeSegment.startsWith(route) && route.length > bestMatchLength) {
					bestMatch = step
					bestMatchLength = route.length
				}
			}
			
			// Check sub-item routes
			if (step.subItems) {
				for (const item of step.subItems) {
					if (routeSegment.startsWith(item.route) && item.route.length > bestMatchLength) {
						bestMatch = step
						bestMatchLength = item.route.length
					}
				}
			}
		}
		
		return bestMatch?.key || "research"
	}

	const currentStep = getCurrentStep()
	const currentStepIndex = journeySteps.findIndex((step) => step.key === currentStep)

	const getRouteUrl = (route: string): string => {
		const routeMap: Record<string, () => string> = {
			"/dashboard": () => routes.dashboard(),
			"/interviews": () => routes.interviews.index(),
			"/personas": () => routes.personas.index(),
			"/people": () => routes.people.index(),
			"/themes": () => routes.themes.index(),
			"/insights": () => routes.insights.index(),
			"/opportunities": () => routes.opportunities.index(),
		}
		return routeMap[route]?.() || route
	}

	if (variant === "stepper") {
		return (
			<div className={cn("bg-background", className)}>
				<div className="mx-auto max-w-[1440px] px-4">
					<div className="flex items-center py-3">
						{journeySteps.map((step, index) => {
							const isActive = step.key === currentStep
							const isCompleted = index < currentStepIndex
							const Icon = step.icon
							const primaryRoute = step.subItems?.[0]?.route || step.routes[0]

							return (
								<div key={step.key} className="flex items-center">
									<NavLink
										to={getRouteUrl(primaryRoute)}
										className={cn(
											"flex cursor-pointer items-center space-x-2 rounded-full px-3 py-1 font-medium text-sm transition-colors hover:bg-accent",
											isActive
												? "bg-primary text-primary-foreground"
												: isCompleted
													? "bg-muted text-foreground"
													: "bg-muted text-foreground hover:text-foreground"
										)}
									>
										<Icon className="h-4 w-4" />
										<span>{step.title}</span>
									</NavLink>
									{index < journeySteps.length - 1 && <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" />}
								</div>
							)
						})}
					</div>
				</div>
			</div>
		)
	}

	if (variant === "bottom") {
		return (
			<nav
				className={cn(
					"fixed right-0 bottom-0 left-0 z-50 flex items-center justify-around border-t bg-background py-2",
					className
				)}
			>
				{journeySteps.map((step) => {
					const isActive = step.key === currentStep
					const Icon = step.icon
					const primaryRoute = step.subItems?.[0]?.route || step.routes[0]

					return (
						<NavLink
							key={step.key}
							to={getRouteUrl(primaryRoute)}
							className={cn(
								"flex min-w-0 flex-1 flex-col items-center space-y-1 rounded-lg px-3 py-2 font-medium text-xs transition-colors",
								isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent hover:text-foreground"
							)}
						>
							<Icon className="h-5 w-5" />
							<span className="truncate">{step.title}</span>
						</NavLink>
					)
				})}
			</nav>
		)
	}

	// Default sidebar variant
	return (
		<nav className={cn("flex w-64 flex-col border-r bg-background", className)}>
			<div className="border-b p-4">
				<h2 className="font-semibold text-lg">Research Journey</h2>
				<p className="text-muted-foreground text-sm">4-step process to insights</p>
			</div>
			<div className="flex-1 overflow-y-auto">
				{journeySteps.map((step, _stepIndex) => {
					const isActive = step.key === currentStep
					const Icon = step.icon

					return (
						<div key={step.key} className="p-2">
							<div
								className={cn(
									"flex items-center space-x-3 rounded-lg p-3 transition-colors",
									isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
								)}
							>
								<Icon className="h-5 w-5 flex-shrink-0" />
								<div className="min-w-0 flex-1">
									<h3 className="font-medium text-sm">{step.title}</h3>
									<p className="truncate text-muted-foreground text-xs">{step.description}</p>
								</div>
							</div>
							{isActive && step.subItems && (
								<div className="mt-2 ml-8 space-y-1">
									{step.subItems.map((item) => (
										<NavLink
											key={item.route}
											to={getRouteUrl(item.route)}
											className={({ isActive: isSubActive }) =>
												cn(
													"block rounded-md px-3 py-2 text-sm transition-colors",
													isSubActive
														? "bg-primary text-primary-foreground"
														: "text-muted-foreground hover:bg-accent hover:text-foreground"
												)
											}
										>
											{item.label}
										</NavLink>
									))}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</nav>
	)
}
