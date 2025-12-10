/**
 * API route to consolidate themes across a project
 *
 * POST: Trigger theme consolidation using AutoGroupThemes BAML function
 * This groups similar themes and links them to evidence
 */

import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
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

		const { client: userDb } = getServerClient(request)

		const formData = await request.formData()
		const projectId = formData.get("project_id")?.toString()
		const accountId = formData.get("account_id")?.toString()

		if (!projectId || !accountId) {
			return Response.json({ error: "project_id and account_id are required" }, { status: 400 })
		}

		// Verify user has access to this project
		const { data: project, error: projectError } = await userDb
			.from("projects")
			.select("id, name")
			.eq("id", projectId)
			.eq("account_id", accountId)
			.single()

		if (projectError || !project) {
			return Response.json({ error: "Project not found or access denied" }, { status: 404 })
		}

		consola.info(`[consolidate-themes] Starting theme consolidation for project ${project.name} (${projectId})`)

		// Run the theme consolidation
		const result = await autoGroupThemesAndApply({
			supabase: userDb,
			account_id: accountId,
			project_id: projectId,
			guidance: "Consolidate similar themes, merge duplicates, and ensure each theme has clear evidence links.",
		})

		consola.success(
			`[consolidate-themes] Completed: created ${result.created_theme_ids.length} themes, ${result.link_count} evidence links`
		)

		return Response.json({
			ok: true,
			created_theme_count: result.created_theme_ids.length,
			link_count: result.link_count,
			theme_ids: result.created_theme_ids,
			message: `Consolidated into ${result.created_theme_ids.length} themes with ${result.link_count} evidence links`,
		})
	} catch (error: unknown) {
		consola.error("[consolidate-themes] Error:", error)
		const message = error instanceof Error ? error.message : "Failed to consolidate themes"
		return Response.json({ ok: false, error: message }, { status: 500 })
	}
}
