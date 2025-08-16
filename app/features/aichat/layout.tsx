import { CopilotKit } from "@copilotkit/react-core"
import { Outlet } from "react-router"

export default function AIChatLayout() {
	return (
		<CopilotKit
			agent="weatherAgent"
			runtimeUrl="/api/copilotkit"
			showDevConsole={true}
			headers={{
				"X-UserId": "100",
				"X-AccountId": "200", 
				"X-ProjectId": "300",
			}}
		>
			<div className="h-screen bg-gray-50">
				<Outlet />
			</div>
		</CopilotKit>
	)
}
