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

		// 3. Aggregate interviews for this persona using junction tables
		const peopleIds = (people ?? []).map((p: any) => p.person_id).filter(Boolean)
		let interviewsRecords: any[] = []
		if (peopleIds.length > 0) {
			const { data: interviewPeopleData, error: interviewPeopleError } = await supabase
				.from("interview_people")
				.select("interview_id")
				.in("person_id", peopleIds)

			if (interviewPeopleError) {
				consola.error("[Persona Insights API] Error fetching interview_people:", interviewPeopleError)
				throw new Response("Failed to fetch interviews", { status: 500 })
			}

			const interviewIds = interviewPeopleData?.map((ip: any) => ip.interview_id).filter(Boolean) || []
			if (interviewIds.length > 0) {
				const { data: interviewsData, error: interviewsError } = await supabase
					.from("interviews")
					.select("*id")
					.in("id", interviewIds)

				if (interviewsError) {
					consola.error("[Persona Insights API] Error fetching interviews:", interviewsError)
					throw new Response("Failed to fetch interviews", { status: 500 })
				}
				interviewsRecords = interviewsData || []
			}
		}

		// 3. Prepare data for baml
		const peopleRecords = (people ?? []).map((p: any) => p.people).filter(Boolean)
		const insightsRecords = (personaInsights ?? []).map((i: any) => i.insights).filter(Boolean)

		consola.log("[Persona Insights API] People Records:", peopleRecords)
		consola.log("[Persona Insights API] Insights Records:", insightsRecords)
		consola.log("[Persona Insights API] Interviews Records:", interviewsRecords)

		// 4. Call baml ExtractPersona
		const bamlResult = await b.ExtractPersona(
			JSON.stringify(peopleRecords),
			JSON.stringify(insightsRecords),
			JSON.stringify(interviewsRecords)
		)

		consola.log("[Persona Insights API] BAML Result:", bamlResult)

		// 5. Update persona record
		const { error: updateError } = await supabase
			.from("personas")
			.update({
				name: bamlResult.name,
				description: bamlResult.description,
				age: bamlResult.age,
				gender: bamlResult.gender,
				location: bamlResult.location,
				education: bamlResult.education,
				occupation: bamlResult.occupation,
				income: bamlResult.income,
				languages: bamlResult.languages,
				segment: bamlResult.segment,
				role: bamlResult.role,
				color_hex: bamlResult.color_hex,
				image_url: bamlResult.image_url,
				motivations: bamlResult.motivations,
				values: bamlResult.values,
				frustrations: bamlResult.frustrations,
				preferences: bamlResult.preferences,
				learning_style: bamlResult.learning_style,
				tech_comfort_level: bamlResult.tech_comfort_level,
				frequency_of_purchase: bamlResult.frequency_of_purchase,
				frequency_of_use: bamlResult.frequency_of_use,
				key_tasks: bamlResult.key_tasks,
				tools_used: bamlResult.tools_used,
				primary_goal: bamlResult.primary_goal,
				secondary_goals: bamlResult.secondary_goals,
				sources: bamlResult.sources,
				quotes: bamlResult.quotes,
				percentage: bamlResult.percentage,
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
