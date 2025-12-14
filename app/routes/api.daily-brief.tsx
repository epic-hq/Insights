import { RequestContext } from "@mastra/core/di"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getSession } from "~/lib/supabase/client.server"
import { mastra } from "~/mastra"

export async function action({ request }: ActionFunctionArgs) {
	// Use your existing server auth utility
	const session = await getSession(request)
	if (!session?.access_token) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { account_id, project_id } = await request.json()

	try {
		// Create user-scoped SupabaseClient with JWT
		const userSupabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
			global: {
				headers: {
					Authorization: `Bearer ${session.access_token}`,
				},
			},
		})

		const workflow = mastra.getWorkflow("dailyBriefWorkflow")
		const run = await workflow.createRunAsync()

		// Create proper RequestContext and inject supabase
		const requestContext = new RequestContext()
		requestContext.set("supabase", userSupabase)

		const result = await run.start({
			inputData: {
				account_id,
				project_id,
			},
			requestContext,
		})

		return Response.json(result)
	} catch (error) {
		consola.error("Daily brief workflow error:", error)
		return Response.json({ error: "Workflow execution failed" }, { status: 500 })
	}
}
