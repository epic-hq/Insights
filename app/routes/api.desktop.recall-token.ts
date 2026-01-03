import type { ActionFunctionArgs } from "react-router"
import { getServerEnv } from "~/env.server"
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server"

const { RECALL_API_KEY } = getServerEnv()

/**
 * POST /api/desktop/recall-token
 * Generate a Recall.ai upload token with embedded metadata for webhook routing.
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const auth = await authenticateDesktopRequest(request)
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { supabase, user } = auth

	try {
		const body = await request.json()
		const { account_id, project_id } = body

		if (!account_id || !project_id) {
			return Response.json({ error: "account_id and project_id are required" }, { status: 400 })
		}

		// Verify user has access to this account
		const { data: accounts } = await supabase.rpc("get_user_accounts")
		const accountsArray = (Array.isArray(accounts) ? accounts : []) as Array<{
			account_id: string
		}>
		const hasAccess = accountsArray.some((a) => a.account_id === account_id)

		if (!hasAccess) {
			return Response.json({ error: "User does not have access to this account" }, { status: 403 })
		}

		// Verify project belongs to account
		const { data: project, error: projectError } = await supabase
			.from("projects")
			.select("id")
			.eq("id", project_id)
			.eq("account_id", account_id)
			.single()

		if (projectError || !project) {
			return Response.json({ error: "Project not found or access denied" }, { status: 403 })
		}

		if (!RECALL_API_KEY) {
			console.error("RECALL_API_KEY not configured")
			return Response.json({ error: "Recall.ai integration not configured" }, { status: 500 })
		}

		// Generate upload token from Recall.ai
		const recallResponse = await fetch("https://us-west-2.recall.ai/api/v1/desktop-sdk-uploads/", {
			method: "POST",
			headers: {
				Authorization: `Token ${RECALL_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				metadata: {
					account_id,
					project_id,
					user_id: user.id,
				},
			}),
		})

		if (!recallResponse.ok) {
			const errorText = await recallResponse.text()
			console.error("Recall.ai token generation failed:", errorText)
			return Response.json({ error: "Failed to generate upload token" }, { status: 502 })
		}

		const recallData = await recallResponse.json()

		return Response.json({
			upload_token: recallData.upload_token,
			expires_at: recallData.expires_at,
			metadata: {
				account_id,
				project_id,
				user_id: user.id,
			},
		})
	} catch (error) {
		console.error("Recall token error:", error)
		return Response.json({ error: "Internal server error" }, { status: 500 })
	}
}
