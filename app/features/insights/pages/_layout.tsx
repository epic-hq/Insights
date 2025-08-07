import { LayoutGrid, MapPin, Rows, Sparkles, Zap } from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export default function InsightsLayout() {
	const navigate = useNavigate()
	const location = useLocation()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	
	// Determine the active tab based on the current URL path
	const getActiveTab = () => {
		const path = location.pathname
		if (path.endsWith('/insights/quick')) return 'quick'
		if (path.endsWith('/insights/table')) return 'table'
		if (path.endsWith('/insights/cards')) return 'cards'
		if (path.endsWith('/insights/map')) return 'map'
		if (path.endsWith('/insights/auto-insights')) return 'auto-takeaways'
		return 'quick' // Default to quick view
	}

	// Handle tab change by navigating to the appropriate route
	const handleTabChange = (value: string) => {
		switch (value) {
			case 'quick':
				navigate(routes.insights.quick())
				break
			case 'table':
				navigate(routes.insights.table())
				break
			case 'cards':
				navigate(routes.insights.cards())
				break
			case 'map':
				navigate(routes.insights.map())
				break
			case 'auto-takeaways':
				navigate(routes.insights.autoInsights())
				break
			default:
				navigate(routes.insights.quick())
		}
	}

	return (
		<div className="w-full">
			{/* Header with consistent spacing */}
			<div className="px-[5%]">
				<div className="mb-6">
					<h1 className="mb-4 text-2xl font-bold">Insights</h1>
				</div>
			</div>

			{/* Tab navigation spanning full width */}
			<div className="px-[5%]">
				<Tabs 
					className="w-full" 
					defaultValue="quick" 
					onValueChange={handleTabChange} 
					value={getActiveTab()}
				>
					<TabsList className="grid w-full grid-cols-5">
						<TabsTrigger className="flex items-center gap-2" value="quick">
							<Zap className="h-4 w-4" /> Quick
						</TabsTrigger>
						<TabsTrigger className="flex items-center gap-2" value="table">
							<Rows className="h-4 w-4" /> Table
						</TabsTrigger>
						<TabsTrigger className="flex items-center gap-2" value="cards">
							<LayoutGrid className="h-4 w-4" /> Cards
						</TabsTrigger>
						<TabsTrigger className="flex items-center gap-2" value="map">
							<MapPin className="h-4 w-4" /> Map
						</TabsTrigger>
						<TabsTrigger className="flex items-center gap-2" value="auto-takeaways">
							<Sparkles className="h-4 w-4" /> Auto-Takeaways
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Outlet content with consistent spacing */}
			<div className="mt-4 px-[5%]">
				<Outlet />
			</div>
		</div>
	)
}
