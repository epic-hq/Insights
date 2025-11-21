import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

interface Payload {
	person_id: string
	kind_slug: string
	summary: string
	account_id: string
	project_id: string
}

export async function action({ request }: ActionFunctionArgs) {
	const { client: supabase } = getServerClient(request)

	try {
		const payload = (await request.json()) as Payload
		const { person_id, kind_slug, summary, account_id, project_id } = payload

		if (!person_id || !kind_slug || summary === undefined || !account_id || !project_id) {
			return Response.json({ error: "Missing parameters" }, { status: 400 })
		}

		consola.log("Updating facet summary:", person_id, kind_slug, summary)

		// Update or insert the facet summary
		const { error } = await supabase
			.from("person_facet_summaries")
			.upsert(
				{
					person_id,
					kind_slug,
					summary,
					account_id,
					project_id,
					generated_at: new Date().toISOString(),
				},
				{
					onConflict: "person_id,kind_slug",
				}
			)

		if (error) {
			consola.error("Error updating facet summary:", error)
			return Response.json({ error: error.message }, { status: 500 })
		}

		return Response.json({ success: true })
	} catch (err) {
		consola.error("Error updating facet summary:", err)
		return Response.json({ error: (err as Error).message }, { status: 500 })
	}
}
