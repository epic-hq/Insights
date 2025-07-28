import type { Decorator } from "@storybook/react"
import { useEffect, useState } from "react"
import { HashRouter, useLocation } from "react-router-dom"
import Breadcrumbs from "~/components/navigation/Breadcrumbs"
import { sampleData } from "~/data/sampleData"
import Dashboard from "~/features/dashboard/components/Dashboard"
import InterviewsList from "~/features/interviews/components/InterviewsList"

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

// Helper function to get display name for the current route
const getRouteDisplayName = (path: string): string => {
	const segments = path.split("/").filter(Boolean)

	// Handle persona detail routes
	if (segments.length === 2 && segments[0] === "personas") {
		const personaSlug = segments[1]
		return routeLabels[personaSlug] || "Persona Details"
	}

	// Handle regular routes
	const mainSegment = segments[0] || ""
	return routeLabels[mainSegment] || mainSegment
}

// Component to handle route changes and display current route
const RouteDisplay = () => {
	const location = useLocation()
	const [activeRoute, setActiveRoute] = useState<string>(location.pathname)

	useEffect(() => {
		setActiveRoute(location.pathname)
	}, [location])

	// This component renders the appropriate content based on the current route
	const renderRouteContent = () => {
		// Check for persona detail routes
		if (activeRoute.startsWith("/personas/")) {
			// No need to extract personaId here as useParams in PersonaDetail will handle it
			// return <PersonaDetail personas={sampleData.personas} />
		}

		// Handle other routes
		switch (activeRoute) {
			case "/interviews":
				return <InterviewsList interviews={sampleData.interviews} />
			// case "/insights":
			// 	return <InsightsList insights={sampleData.insights || []} getInsightId={(_, index) => `insight-${index}`} />
			// case "/opportunities":
			// 	return <OpportunitiesList opportunities={sampleData.opportunities || []} />
			// case "/personas":
			// 	return <PersonasList personas={sampleData.personas} totalParticipants={80} />
			case "/":
				return <Dashboard {...sampleData} />
			default:
				return null
		}
	}

	// Only show route content if we're not at the root
	if (activeRoute === "/") {
		return null
	}

	return (
		<div className="fixed inset-0 z-50 overflow-auto bg-white p-4 dark:bg-gray-900">
			<div className="mx-auto max-w-7xl">
				<div className="mb-4">
					<Breadcrumbs className="mb-2" />
					<h1 className="font-bold text-xl capitalize">{getRouteDisplayName(activeRoute)}</h1>
				</div>
				{renderRouteContent()}
			</div>
		</div>
	)
}

/**
 * RouterDecorator provides HashRouter context for Storybook stories
 * and includes route definitions matching the main application
 */
export const RouterDecorator: Decorator = (Story) => {
	return (
		<HashRouter>
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
				<div className="container mx-auto px-4 py-8">
					{/* Main story content */}
					<Story />

					{/* Route display component that shows the appropriate content */}
					<RouteDisplay />
				</div>
			</div>
		</HashRouter>
	)
}
