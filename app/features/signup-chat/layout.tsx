import { Outlet } from "react-router"

export default function AIChatLayout() {
	return (
			<div className="h-screen bg-gray-50">
				<Outlet />
			</div>
	)
}
