import { useEffect } from "react"
import type { MetaFunction } from "react-router"
import { useLocation, useNavigate } from "react-router-dom"
import { useProjectPath } from "~/hooks/use-project-path"

export const meta: MetaFunction = () => {
	return [{ title: "Insights | Insights" }, { name: "description", content: "View and manage all insights" }]
}

export default function Insights() {
	const navigate = useNavigate()
	const location = useLocation()
	const projectPath = useProjectPath()

	// If we're at the root insights path, redirect to the table view
	useEffect(() => {
		if (location.pathname.includes("/insights")) {
			navigate(`${projectPath("INSIGHTS")}/table`, { replace: true })
		}
	}, [location.pathname, navigate, projectPath])

	// This component just handles the redirect - the layout handles the UI
	return null
}
