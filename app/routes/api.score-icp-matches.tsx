/**
 * API route to score ICP matches for all people in a project
 *
 * POST: Trigger batch ICP scoring task
 * Returns taskId for tracking progress
 */

import { auth, tasks } from "@trigger.dev/sdk/v3"
import type { ActionFunctionArgs } from "react-router"
import type { scoreICPMatchesTask } from "~/../src/trigger/people/scoreICPMatches"
import { getServerClient } from "~/lib/supabase/client.server"

async function createAccessToken(runId: string): Promise<string | null> {
	try {
		return await auth.createPublicToken({
			scopes: {
				read: {
					runs: [runId],
					tasks: ["people.score-icp-matches"],
				},
			},
			expirationTime: "1h",
		})
	} catch (error) {
		console.warn("[score-icp-matches] Failed to create public token:", error)
		return null
	}
}

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

		const body = await request.json()
		const projectId = body.projectId
		const personId = body.personId // Optional - score just one person
		const force = body.force === true // Re-score even if exists

		if (!projectId) {
			return Response.json({ success: false, error: "Missing projectId" }, { status: 400 })
		}

		// Verify project exists and user has access
		const { data: project, error: projectError } = await userDb
			.from("projects")
			.select("id, account_id")
			.eq("id", projectId)
			.single()

		if (projectError || !project) {
			return Response.json({ success: false, error: "Project not found" }, { status: 404 })
		}

		// Trigger the scoring task
		const handle = await tasks.trigger<typeof scoreICPMatchesTask>("people.score-icp-matches", {
			projectId: project.id,
			accountId: project.account_id,
			personId,
			force,
		})

		// Create public access token for realtime progress
		const publicAccessToken = await createAccessToken(handle.id)

		return Response.json({
			success: true,
			taskId: handle.id,
			publicAccessToken,
			message: personId ? "Scoring ICP match for person" : "Scoring ICP matches for all people",
		})
	} catch (error: any) {
		console.error("[score-icp-matches] Error:", error)
		return Response.json(
			{
				success: false,
				error: error?.message || "Failed to trigger ICP scoring",
			},
			{ status: 500 }
		)
	}
}
