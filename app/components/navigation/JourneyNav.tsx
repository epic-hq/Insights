import { Search, Users, TrendingUp, Lightbulb, ChevronRight } from "lucide-react"
import { NavLink, useLocation } from "react-router"
import { cn } from "~/lib/utils"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { useCurrentProject } from "~/contexts/current-project-context"

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
		icon: Search,
		routes: ["/dashboard", "/interviews"],
		subItems: [
			{ label: "Status", route: "/dashboard", description: "Project overview & recommendations" },
			{ label: "Interviews", route: "/interviews", description: "Transcripts & evidence collection" },
			{ label: "Add Data", route: "/interviews/new", description: "Upload interviews & surveys" },
		],
	},
	{
		key: "personas",
		title: "Personas & People",
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
		title: "Patterns",
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
		title: "Insights & Opps",
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
		return (
			journeySteps.find(
				(step) =>
					step.routes.some((route) => currentPath.includes(route)) ||
					step.subItems?.some((item) => currentPath.includes(item.route))
			)?.key || "research"
		)
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
											"flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer hover:bg-accent",
											isActive
												? "bg-primary text-primary-foreground"
												: isCompleted
													? "bg-muted text-muted-foreground"
													: "bg-muted text-muted-foreground hover:text-foreground"
										)}
									>
										<Icon className="h-4 w-4" />
										<span>{step.title}</span>
									</NavLink>
									{index < journeySteps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
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
					"fixed bottom-0 left-0 right-0 bg-background border-t flex items-center justify-around py-2 z-50",
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
								"flex flex-col items-center space-y-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-w-0 flex-1",
								isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
		<nav className={cn("w-64 bg-background border-r flex flex-col", className)}>
			<div className="p-4 border-b">
				<h2 className="font-semibold text-lg">Research Journey</h2>
				<p className="text-sm text-muted-foreground">4-step process to insights</p>
			</div>
			<div className="flex-1 overflow-y-auto">
				{journeySteps.map((step, stepIndex) => {
					const isActive = step.key === currentStep
					const Icon = step.icon

					return (
						<div key={step.key} className="p-2">
							<div
								className={cn(
									"flex items-center space-x-3 p-3 rounded-lg transition-colors",
									isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
								)}
							>
								<Icon className="h-5 w-5 flex-shrink-0" />
								<div className="flex-1 min-w-0">
									<h3 className="font-medium text-sm">{step.title}</h3>
									<p className="text-xs text-muted-foreground truncate">{step.description}</p>
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
													"block px-3 py-2 text-sm rounded-md transition-colors",
													isSubActive
														? "bg-primary text-primary-foreground"
														: "text-muted-foreground hover:text-foreground hover:bg-accent"
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
