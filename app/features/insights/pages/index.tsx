import { useEffect } from "react"
import type { MetaFunction } from "react-router"
import { useLocation, useNavigate } from "react-router-dom"
import { useCurrentProject } from "~/contexts/current-project-context"
import { projectPath } from "~/paths"

export const meta: MetaFunction = () => {
	return [{ title: "Insights | Insights" }, { name: "description", content: "View and manage all insights" }]
}

export default function Insights() {
	const navigate = useNavigate()
	const location = useLocation()
	const { accountId, projectId } = useCurrentProject()

	// If we're at the root insights path, redirect to the table view
	useEffect(() => {
		if (location.pathname.includes("/insights")) {
			navigate(`${projectPath("INSIGHTS", accountId, projectId, "/table")}`, { replace: true })
		}
	}, [location.pathname, navigate, accountId, projectId])

	// This component just handles the redirect - the layout handles the UI
	return null
}
