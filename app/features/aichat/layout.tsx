import { CopilotKit } from "@copilotkit/react-core"
import { Outlet } from "react-router"

export default function AIChatLayout() {
	return (
		<CopilotKit
			agent="mainAgent"
			runtimeUrl="/api/copilotkit"
			publicApiKey="ck_pub_ee4a155857823bf6b0a4f146c6c9a72f"
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
