import { MastraAgent } from "@ag-ui/mastra"
import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint, ExperimentalEmptyAdapter } from "@copilotkit/runtime"
import type { ActionFunctionArgs } from "react-router"
import { mastra } from "~/mastra"

export const loader = () => new Response("Method Not Allowed", { status: 405 })

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}

	// Get Mastra agents for CopilotKit integration
	const mastraAgents = MastraAgent.getLocalAgents({ mastra })

	const runtime = new CopilotRuntime({
		agents: mastraAgents,
	})

	const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
		runtime,
		serviceAdapter: new ExperimentalEmptyAdapter(),
		endpoint: "/api/copilotkit",
	})

	return handleRequest(request)
}
