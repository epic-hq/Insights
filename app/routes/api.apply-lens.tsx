/**
 * API route to apply a conversation lens to an interview
 *
 * POST: Trigger lens application for a specific template
 */

import { tasks } from "@trigger.dev/sdk/v3"
import type { ActionFunctionArgs } from "react-router"
import type { applyAllLensesTask } from "~/../src/trigger/lens/applyAllLenses"
import type { applyLensTask } from "~/../src/trigger/lens/applyLens"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		// Get authenticated user
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server")
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get user-scoped client
		const { client: userDb } = getServerClient(request)

		const formData = await request.formData()
		const interviewId = formData.get("interview_id")?.toString()
		const templateKey = formData.get("template_key")?.toString()
		const applyAll = formData.get("apply_all")?.toString() === "true"

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

		if (applyAll) {
			// Apply all system lenses
			const handle = await tasks.trigger<typeof applyAllLensesTask>("lens.apply-all-lenses", {
				interviewId: interview.id,
				accountId: interview.account_id,
				projectId: interview.project_id,
				computedBy: claims.sub,
			})

			return Response.json({
				ok: true,
				taskId: handle.id,
				message: "Applying all lenses",
			})
		}

		if (!templateKey) {
			return Response.json({ ok: false, error: "Missing template_key" }, { status: 400 })
		}

		// Verify template exists
		const { data: template, error: templateError } = await userDb
			.from("conversation_lens_templates")
			.select("template_key, template_name")
			.eq("template_key", templateKey)
			.eq("is_active", true)
			.single()

		if (templateError || !template) {
			return Response.json({ ok: false, error: "Template not found" }, { status: 404 })
		}

		// Create pending analysis record
		await userDb.from("conversation_lens_analyses").upsert(
			{
				interview_id: interview.id,
				template_key: templateKey,
				account_id: interview.account_id,
				project_id: interview.project_id,
				status: "pending",
				processed_by: claims.sub,
			},
			{ onConflict: "interview_id,template_key" }
		)

		// Trigger the lens application task
		const handle = await tasks.trigger<typeof applyLensTask>("lens.apply-lens", {
			interviewId: interview.id,
			templateKey,
			accountId: interview.account_id,
			projectId: interview.project_id,
			computedBy: claims.sub,
		})

		return Response.json({
			ok: true,
			taskId: handle.id,
			templateKey,
			message: `Applying ${template.template_name} lens`,
		})
	} catch (error: any) {
		console.error("[apply-lens] Error:", error)
		return Response.json(
			{
				ok: false,
				error: error?.message || "Failed to apply lens",
			},
			{ status: 500 }
		)
	}
}
