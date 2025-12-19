/**
 * API route to manually trigger sales lens generation for an interview
 */

import { tasks } from "@trigger.dev/sdk/v3"
import type { ActionFunctionArgs } from "react-router"
import type { generateSalesLensTask } from "~/../src/trigger/sales/generateSalesLens"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const { user: claims } = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request)

		const formData = await request.formData()
		const interviewId = formData.get("interview_id")?.toString()

		if (!interviewId) {
			return Response.json({ ok: false, error: "Missing interview_id" }, { status: 400 })
		}

		// Verify interview exists and user has access
		const { data: interview, error: interviewError } = await userDb
			.from("interviews")
			.select("id, account_id, project_id")
			.eq("id", interviewId)
			.single()

		if (interviewError || !interview) {
			return Response.json({ ok: false, error: "Interview not found" }, { status: 404 })
		}

		// Set interview status to "processing" to show progress indicator
		await userDb.from("interviews").update({ status: "processing" }).eq("id", interview.id)

		// Trigger the sales lens generation task
		const handle = await tasks.trigger<typeof generateSalesLensTask>("sales.generate-sales-lens", {
			interviewId: interview.id,
			computedBy: claims.sub,
		})

		return Response.json({
			ok: true,
			taskId: handle.id,
			message: "Sales lens generation started",
		})
	} catch (error: any) {
		console.error("[generate-sales-lens] Error:", error)
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to generate sales lens",
			},
			{ status: 500 }
		)
	}
}
