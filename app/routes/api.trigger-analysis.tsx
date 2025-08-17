import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createSupabaseAdminClient } from "~/lib/supabase/server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const supabase = createSupabaseAdminClient()

		// Trigger the analysis worker Edge Function
		const { data, error } = await supabase.functions.invoke("analysis_worker")

		if (error) {
			consola.error("Analysis worker error:", error)
			return Response.json({ error: error.message }, { status: 500 })
		}

		consola.log("Analysis worker triggered successfully:", data)
		return Response.json({ success: true, result: data })
	} catch (error) {
		consola.error("Failed to trigger analysis worker:", error)
		return Response.json(
			{ error: error instanceof Error ? error.message : "Failed to trigger analysis" },
			{ status: 500 }
		)
	}
}
