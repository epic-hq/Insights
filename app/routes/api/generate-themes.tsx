import type { ActionFunctionArgs } from "react-router"
import { autoGroupThemesAndApply } from "~/features/themes/db.autoThemes.server"
import { userContext } from "~/server/user-context"
import consola from "consola"

export async function action({ context, request }: ActionFunctionArgs) {
	const { supabase, account_id } = context.get(userContext)
	const formData = await request.formData()
	const projectId = formData.get("projectId") as string
	const guidance = formData.get("guidance") as string || ""

	if (!projectId || !account_id) {
		return new Response("Missing projectId or account_id", { status: 400 })
	}

	try {
		consola.log("[Generate Themes API] Starting theme generation for project:", projectId)
		
		const result = await autoGroupThemesAndApply({
			supabase,
			account_id,
			project_id: projectId,
			guidance,
			limit: 200
		})

		consola.log("[Generate Themes API] Generated themes:", result)
		
		return Response.json({
			success: true,
			created_theme_ids: result.created_theme_ids,
			theme_count: result.themes.length,
			link_count: result.link_count
		})
	} catch (error) {
		consola.error("[Generate Themes API] Error:", error)
		return new Response(`Failed to generate themes: ${error}`, { status: 500 })
	}
}
