import { useEffect } from "react"
import type { MetaFunction } from "react-router"
import { useNavigate, useLocation } from "react-router-dom"

export const meta: MetaFunction = () => {
	return [{ title: "Insights | Insights" }, { name: "description", content: "View and manage all insights" }]
}



export default function Insights() {
	const navigate = useNavigate()
	const location = useLocation()

	// If we're at the root insights path, redirect to the table view
	useEffect(() => {
		if (location.pathname === '/insights') {
			navigate('/insights/table', { replace: true })
		}
	}, [location.pathname, navigate])

	// This component just handles the redirect - the layout handles the UI
	return null
}
