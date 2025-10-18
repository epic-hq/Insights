import type { ActionFunctionArgs } from "react-router"
import consola from "consola"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { createRunAccessToken } from "~/utils/processInterviewAnalysis.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const user = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "User not authenticated" }, { status: 401 })
	}

	try {
		const { runId } = (await request.json()) as { runId?: string }

		if (!runId) {
			return Response.json({ error: "Missing runId" }, { status: 400 })
		}

		const token = await createRunAccessToken(runId)

		if (!token) {
			return Response.json({ error: "Failed to create access token" }, { status: 500 })
		}

		return Response.json({ token })
	} catch (error) {
		consola.error("Failed to create Trigger.dev token", error)
		return Response.json({ error: "Failed to create access token" }, { status: 500 })
	}
}
