import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { mastra } from "~/mastra"

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		// Get authenticated user
		const { user } = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get the main agent
		const agent = mastra.getAgent("mainAgent")
		if (!agent) {
			return Response.json({ error: "Main agent not found" }, { status: 404 })
		}

		// Test tool execution with sample data
		const testInput = {
			accountId: user.account_id,
			searchText: "user",
			limit: 5,
		}

		consola.log("Testing upsight tool with input:", testInput)

		// Test the upsight tool via agent
		const result = await agent.generate("Test upsight tool with search: user", {
			context: {
				user_id: user.id,
				account_id: user.account_id,
				project_id: "test-project",
			},
		})

		consola.log("Agent result:", result)

		return {
			success: true,
			agentResult: result,
			testInput,
			timestamp: new Date().toISOString(),
		}
	} catch (error) {
		consola.error("Error testing upsight tool:", error)
		return Response.json(
			{
				error: "Failed to test upsight tool",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		)
	}
}

export default function TestUpsight() {
	return (
		<div className="p-8">
			<h1 className="mb-4 font-bold text-2xl">Upsight Tool Test</h1>
			<p>Check the browser console and network tab for test results.</p>
		</div>
	)
}
