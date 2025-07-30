import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { b } from "~/../baml_client"
import { getServerClient } from "~/lib/supabase/server"

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub

		if (!accountId) {
			consola.error("[Persona Insights API] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		const formData = await request.formData()
		const personaId = formData.get("personaId") as string
		if (!personaId) {
			throw new Response("Missing personaId", { status: 400 })
		}

		// 1. Aggregate people for this persona
		const { data: people, error: peopleError } = await supabase
			.from("people_personas")
			.select("person_id, people(*)")
			.eq("persona_id", personaId)

		if (peopleError) {
			consola.error("[Persona Insights API] Error fetching people:", peopleError)
			throw new Response("Failed to fetch people", { status: 500 })
		}

		// 2. Aggregate insights for this persona
		const { data: personaInsights, error: insightsError } = await supabase
			.from("persona_insights")
			.select("insight_id, insights(*)")
			.eq("persona_id", personaId)

		if (insightsError) {
			consola.error("[Persona Insights API] Error fetching insights:", insightsError)
			throw new Response("Failed to fetch insights", { status: 500 })
		}

		// 3. Prepare data for baml
		const peopleRecords = (people ?? []).map((p: any) => p.people).filter(Boolean)
		const insightsRecords = (personaInsights ?? []).map((i: any) => i.insights).filter(Boolean)

		// 4. Call baml ExtractPersona
		const bamlResult = await b.ExtractPersona(JSON.stringify(peopleRecords), JSON.stringify(insightsRecords))

		consola.log("[Persona Insights API] BAML Result:", bamlResult)

		// 5. Update persona record
		const { error: updateError } = await supabase
			.from("personas")
			.update({
				description: bamlResult.description,
				demographics: bamlResult.demographics,
				summarized_insights: bamlResult.summarized_insights,
				updated_at: new Date().toISOString(),
			})
			.eq("id", personaId)
			.eq("account_id", accountId)

		if (updateError) {
			consola.error("[Persona Insights API] Error updating persona:", updateError)
			throw new Response("Failed to update persona", { status: 500 })
		}

		return {
			success: true,
			data: bamlResult,
		}
	} catch (error) {
		consola.error("[Persona Insights API] Error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
