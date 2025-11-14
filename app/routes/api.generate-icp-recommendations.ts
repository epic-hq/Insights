import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { generatePersonasForProject } from "~/features/personas/services/generatePersonas.server"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub

		if (!accountId) {
			consola.error("[Generate Personas API] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		const formData = await request.formData()
		const projectId = formData.get("projectId") as string

		if (!projectId) {
			throw new Response("Missing projectId", { status: 400 })
		}

		consola.info(`[Generate Personas API] Starting persona generation for project ${projectId}`)

		// Use the new facet-driven persona generation service
		const { personas, people_links } = await generatePersonasForProject(supabase, projectId, accountId)

		if (personas.length === 0) {
			consola.warn("[Generate Personas API] No personas generated - insufficient data")
			return {
				success: false,
				message: "Not enough data to generate personas. Need at least 2 people with shared facets.",
			}
		}

		// Insert personas into database
		const { data: createdPersonas, error: insertError } = await supabase
			.from("personas")
			.insert(personas)
			.select()

		if (insertError) {
			consola.error("[Generate Personas API] Failed to save personas:", insertError)
			throw new Response("Failed to save personas", { status: 500 })
		}

		// Create people-persona links
		const linksToInsert = people_links.map((link, idx) => ({
			persona_id: createdPersonas![Math.floor(idx / (people_links.length / personas.length))].id,
			person_id: link.person_id,
		}))

		const { error: linkError } = await supabase.from("people_personas").insert(linksToInsert)

		if (linkError) {
			consola.warn("[Generate Personas API] Failed to link some people to personas:", linkError)
			// Don't fail the whole operation
		}

		consola.info(
			`[Generate Personas API] Successfully created ${createdPersonas?.length || 0} personas with ${linksToInsert.length} people links`
		)

		return {
			success: true,
			personas: createdPersonas,
			linked_people: linksToInsert.length,
		}
	} catch (error) {
		consola.error("[Generate Personas API] Error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
