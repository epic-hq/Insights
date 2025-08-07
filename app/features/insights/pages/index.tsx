import { useEffect } from "react"
import type { MetaFunction } from "react-router"
import { useLocation, useNavigate } from "react-router-dom"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export const meta: MetaFunction = () => {
	return [{ title: "Insights | Insights" }, { name: "description", content: "View and manage all insights" }]
}

export default function Insights() {
	const navigate = useNavigate()
	const location = useLocation()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	// Only redirect if we're at the exact insights root path (not sub-routes)
	useEffect(() => {
		const isExactInsightsPath = location.pathname.endsWith("/insights") && !location.pathname.includes("/insights/")

		if (isExactInsightsPath) {
			navigate(routes.insights.quick(), { replace: true })
		}
	}, [location.pathname, navigate, routes])

	// This component just handles the redirect - the layout handles the UI
	return null
}
