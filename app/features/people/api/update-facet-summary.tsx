import consola from "consola"
import type { ActionFunction } from "react-router"
import { userContext } from "~/server/user-context"

interface Payload {
	person_id: string
	kind_slug: string
	summary: string
}

export const action: ActionFunction = async ({ context, request }) => {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id

	try {
		const payload = (await request.json()) as Payload
		const { person_id, kind_slug, summary } = payload

		if (!person_id || !kind_slug || summary === undefined) {
			return Response.json({ error: "Missing parameters" }, { status: 400 })
		}

		consola.log("Updating facet summary:", person_id, kind_slug, summary)

		// Get the person's project_id
		const { data: person, error: personError } = await supabase
			.from("people")
			.select("project_id")
			.eq("id", person_id)
			.eq("account_id", accountId)
			.single()

		if (personError || !person) {
			consola.error("Error getting person:", personError)
			return Response.json({ error: "Person not found" }, { status: 404 })
		}

		// Update or insert the facet summary
		const { error } = await supabase
			.from("person_facet_summaries")
			.upsert(
				{
					person_id,
					kind_slug,
					summary,
					account_id: accountId,
					project_id: person.project_id,
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
