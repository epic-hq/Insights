import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { b } from "~/../baml_client"
import { getServerClient } from "~/lib/supabase/server"
import type { Interview, Person } from "~/types"

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		// const accountId = jwt?.claims.sub
		const projectId = params?.projectId as string
		const accountId = params?.accountId as string

		if (!projectId) {
			consola.error("[Generate Personas API] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		// 1. Aggregate all interviews for the project
		const { data: interviews, error: interviewsError } = await supabase
			.from("interviews")
			.select("id")
			.eq("project_id", projectId)

		if (interviewsError) {
			consola.error("[Generate Personas API] Error fetching interviews:", interviewsError)
			throw new Response("Failed to fetch interviews", { status: 500 })
		}

		// 2. Aggregate all people linked to those interviews
		const interviewIds = (interviews ?? []).map((i: Interview) => i.id)
		let people: Person[] = []
		if (interviewIds.length > 0) {
			const { data: interviewPeople, error: interviewPeopleError } = await supabase
				.from("interview_people")
				.select("person_id, people(*)")
				.in("interview_id", interviewIds)

			if (interviewPeopleError) {
				consola.error("[Generate Personas API] Error fetching interview_people:", interviewPeopleError)
				throw new Response("Failed to fetch people", { status: 500 })
			}
			// Supabase join returns people as an array, so flatten and filter
			people = (interviewPeople ?? [])
				.map((ip: { people: Person | Person[] }) => (Array.isArray(ip.people) ? ip.people[0] : ip.people))
				.filter(Boolean)
		}

		// 3. Aggregate all insights for the 	project
		const { data: insights, error: insightsError } = await supabase
			.from("insights")
			.select("*")
			.eq("project_id", projectId)

		if (insightsError) {
			consola.error("[Generate Personas API] Error fetching insights:", insightsError)
			throw new Response("Failed to fetch insights", { status: 500 })
		}

		// 4. Call BAML GeneratePersonas
		const people_len = people.reduce((len, p) => len + JSON.stringify(p).length, 0)
		const insights_len = insights.reduce((len, i) => len + JSON.stringify(i).length, 0)
		const interviews_len = interviews.reduce((len, i) => len + JSON.stringify(i).length, 0)
		consola.log(
			`[Generate Personas API] Input lengths: people=${people_len}, insights=${insights_len}, interviews=${interviews_len}`
		)

		const bamlResult = await b.GeneratePersonas(
			// JSON.stringify(interviews ?? []),
			JSON.stringify(people ?? []),
			JSON.stringify(insights ?? [])
		)

		consola.log("[Generate Personas API] BAML Result:", bamlResult)

		// 5. Store personas in the database (upsert by name+account)
		for (const persona of bamlResult) {
			const { error: insertError } = await supabase.from("personas").insert({
				account_id: accountId,
				project_id: projectId,
				name: persona.name,
				description: persona.description,
				age: persona.age,
				gender: persona.gender,
				location: persona.location,
				education: persona.education,
				occupation: persona.occupation,
				income: persona.income,
				languages: persona.languages,
				segment: persona.segment,
				role: persona.role,
				color_hex: persona.color_hex,
				image_url: persona.image_url,
				motivations: persona.motivations,
				values: persona.values,
				frustrations: persona.frustrations,
				preferences: persona.preferences,
				learning_style: persona.learning_style,
				tech_comfort_level: persona.tech_comfort_level,
				frequency_of_purchase: persona.frequency_of_purchase,
				frequency_of_use: persona.frequency_of_use,
				key_tasks: persona.key_tasks,
				tools_used: persona.tools_used,
				primary_goal: persona.primary_goal,
				secondary_goals: persona.secondary_goals,
				sources: persona.sources,
				quotes: persona.quotes,
				percentage: persona.percentage,
				updated_at: new Date().toISOString(),
			})
			if (insertError) {
				consola.warn("[Generate Personas API] Failed to insert persona:", persona.name, insertError)
			}
		}

		return { success: true, personas: bamlResult }
	} catch (error) {
		consola.error("[Generate Personas API] Error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
