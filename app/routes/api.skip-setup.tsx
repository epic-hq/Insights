/**
 * API route to mark project setup as visited (skipped)
 *
 * Allows users to escape the setup flow per Don Norman's principle.
 * Sets visited: true without requiring goals to be completed.
 */

import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import type { Database } from "~/types"

export async function action({ context, request }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const userId = ctx.claims?.sub

	if (!supabase || !userId) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const formData = await request.formData()
	const projectId = formData.get("projectId") as string

	if (!projectId) {
		return Response.json({ error: "projectId required" }, { status: 400 })
	}

	// Get current settings
	const { data: settings } = await supabase
		.from("user_settings")
		.select("onboarding_steps")
		.eq("user_id", userId)
		.single()

	const steps = (settings?.onboarding_steps as Record<string, unknown>) || {}
	const setupByProject = (steps.project_setup as Record<string, unknown>) || {}

	const nextSteps = {
		...steps,
		project_setup: {
			...setupByProject,
			[projectId]: {
				...(setupByProject[projectId] as Record<string, unknown> | undefined),
				visited: true,
				skipped: true,
				skipped_at: new Date().toISOString(),
			},
		},
	}

	await supabase
		.from("user_settings")
		.update({
			onboarding_steps: nextSteps as Database["public"]["Tables"]["user_settings"]["Update"]["onboarding_steps"],
		})
		.eq("user_id", userId)

	return Response.json({ success: true })
}
