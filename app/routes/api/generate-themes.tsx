import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { userContext } from "~/server/user-context"

export async function action({ context, request }: ActionFunctionArgs) {
	const { supabase, account_id } = context.get(userContext)
	const formData = await request.formData()
	const projectId = formData.get("projectId") as string
	const guidance = (formData.get("guidance") as string) || ""

	consola.log("[Generate Themes API] Received request for project:", projectId, "with guidance:", guidance)

	if (!projectId || !account_id) {
		return new Response("Missing projectId or account_id", { status: 400 })
	}

	try {
		consola.log("[Generate Themes API] Starting theme generation for project:", projectId)
		consola.log("[Generate Themes API] Account ID:", account_id)

		const result = await autoGroupThemesAndApply({
			supabase,
			account_id,
			project_id: projectId,
			guidance,
			limit: 200,
		})

		consola.log("[Generate Themes API] Generated themes:", result)

		return Response.json({
			success: true,
			created_theme_ids: result.created_theme_ids,
			theme_count: result.themes.length,
			link_count: result.link_count,
		})
	} catch (error) {
		consola.error("[Generate Themes API] Error details:", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			projectId,
			account_id,
		})
		return Response.json(
			{ 
				success: false, 
				error: error instanceof Error ? error.message : String(error),
				details: "Check server logs for full error details"
			}, 
			{ status: 500 }
		)
	}
}
