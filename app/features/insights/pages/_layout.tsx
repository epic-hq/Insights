import { LayoutGrid, Rows } from "lucide-react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export default function InsightsLayout() {
	const navigate = useNavigate()
	const location = useLocation()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	// Determine the active view based on the current URL path
	const getActiveView = () => {
		const path = location.pathname
		if (path.endsWith("/insights/table")) return "table"
		return "cards" // Default to cards view (quick)
	}

	// Handle view change by navigating to the appropriate route
	const handleViewChange = (value: string) => {
		switch (value) {
			case "cards":
				navigate(routes.insights.quick())
				break
			case "table":
				navigate(routes.insights.table())
				break
			default:
				navigate(routes.insights.quick())
		}
	}

	return (
		<PageContainer className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1.5">
					<h1 className="font-semibold text-3xl text-foreground">Insights</h1>
					<p className="max-w-2xl text-sm text-foreground/70">
						Browse and analyze all insights from your research.
					</p>
				</div>
				<ToggleGroup
					type="single"
					value={getActiveView()}
					onValueChange={(next) => next && handleViewChange(next)}
					size="sm"
					className="shrink-0"
				>
					<ToggleGroupItem value="cards" aria-label="Cards view" className="gap-2">
						<LayoutGrid className="h-4 w-4" />
						Cards
					</ToggleGroupItem>
					<ToggleGroupItem value="table" aria-label="Table view" className="gap-2">
						<Rows className="h-4 w-4" />
						Table
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{/* Outlet content */}
			<Outlet />
		</PageContainer>
	)
}
