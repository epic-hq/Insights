import type { ActionFunctionArgs } from "react-router"
import { tasks } from "@trigger.dev/sdk"
import type { enrichThemesBatch } from "~/../../src/trigger/enrich-themes"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const userId = jwt?.claims.sub

	if (!userId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const formData = await request.formData()
	const projectId = formData.get("project_id") as string
	const accountId = formData.get("account_id") as string
	const maxThemes = Number.parseInt(formData.get("max_themes") as string) || 50

	if (!projectId || !accountId) {
		throw new Response("Missing project_id or account_id", { status: 400 })
	}

	// Verify user has access to this project
	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("id, account_id")
		.eq("id", projectId)
		.eq("account_id", accountId)
		.single()

	if (projectError || !project) {
		throw new Response("Project not found or access denied", { status: 403 })
	}

	try {
		// Trigger the batch enrichment task
		const handle = await tasks.trigger<typeof enrichThemesBatch>("enrich-themes-batch", {
			project_id: projectId,
			account_id: accountId,
			max_themes: maxThemes,
		})

		return {
			success: true,
			taskId: handle.id,
			message: `Theme enrichment started. Processing up to ${maxThemes} themes.`,
		}
	} catch (error: any) {
		console.error("[enrich-themes] Failed to trigger task:", error)
		throw new Response(error.message || "Failed to start enrichment", { status: 500 })
	}
}
