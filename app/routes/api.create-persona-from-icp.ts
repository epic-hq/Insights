import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { redirect } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

type PersonaInsert = Database["public"]["Tables"]["personas"]["Insert"]

/**
 * Find all people who match the given facet criteria
 * Facets format: { person: { job_function: "VP Engineering", ... }, org: { ... } }
 */
async function findPeopleMatchingFacets(
	supabase: any,
	projectId: string,
	facets: { person: Record<string, any>; org: Record<string, any> }
): Promise<any[]> {
	// Get account ID for this project
	const { data: project } = await supabase.from("projects").select("account_id").eq("id", projectId).single()

	if (!project) {
		consola.error("[Find Matching People] Project not found")
		return []
	}

	const accountId = project.account_id

	// Combine person and org facets
	const allFacets = { ...facets.person, ...facets.org }
	const facetKindSlugs = Object.keys(allFacets)
	const facetLabels = Object.values(allFacets)

	if (facetKindSlugs.length === 0) {
		consola.warn("[Find Matching People] No facets provided")
		return []
	}

	// Get facet IDs from labels
	const { data: facetRecords, error: facetError } = await supabase
		.from("facet_account")
		.select("id, label, facet_kind_global!inner(slug)")
		.eq("account_id", accountId)
		.in("label", facetLabels)

	if (facetError || !facetRecords) {
		consola.error("[Find Matching People] Error fetching facets:", facetError)
		return []
	}

	// Map to get facet IDs we need to match
	const targetFacetIds = new Set(facetRecords.map((f) => f.id))

	if (targetFacetIds.size === 0) {
		return []
	}

	// Find all people who have ALL of these facets
	const { data: personFacets, error: personFacetsError } = await supabase
		.from("person_facet")
		.select("person_id, facet_account_id")
		.in("facet_account_id", Array.from(targetFacetIds))
		.eq("project_id", projectId)

	if (personFacetsError) {
		consola.error("[Find Matching People] Error fetching person facets:", personFacetsError)
		return []
	}

	// Group by person and count facets
	const personFacetCounts = new Map<string, number>()
	for (const pf of personFacets || []) {
		personFacetCounts.set(pf.person_id, (personFacetCounts.get(pf.person_id) || 0) + 1)
	}

	// Filter people who have ALL required facets
	const matchingPeopleIds = Array.from(personFacetCounts.entries())
		.filter(([_, count]) => count === targetFacetIds.size)
		.map(([personId, _]) => personId)

	if (matchingPeopleIds.length === 0) {
		return []
	}

	// Get full person objects
	const { data: people, error: peopleError } = await supabase
		.from("people")
		.select("id")
		.in("id", matchingPeopleIds)

	if (peopleError) {
		consola.error("[Find Matching People] Error fetching people:", peopleError)
		return []
	}

	return people || []
}

export async function action({ request, params }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = params.accountId as string

		if (!accountId) {
			consola.error("[Create Persona from ICP] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		const formData = await request.formData()
		const name = formData.get("name") as string
		const description = formData.get("description") as string
		const facetsJson = formData.get("facets") as string
		const projectId = formData.get("projectId") as string

		if (!name || !projectId) {
			throw new Response("Missing required fields", { status: 400 })
		}

		let facets: any = {}
		try {
			facets = JSON.parse(facetsJson || "{}")
		} catch {
			consola.warn("[Create Persona from ICP] Invalid facets JSON")
		}

		consola.info(`[Create Persona from ICP] Creating persona "${name}" for project ${projectId}`)

		// Create persona with ICP data
		const personaData: PersonaInsert = {
			name,
			description,
			account_id: accountId,
			project_id: projectId,
			// Store facets in segment field for now (could add dedicated facet columns later)
			segment: JSON.stringify(facets),
		}

		const { data: persona, error } = await supabase.from("personas").insert(personaData).select().single()

		if (error) {
			consola.error("[Create Persona from ICP] Error creating persona:", error)
			throw new Response(`Failed to create persona: ${error.message}`, { status: 500 })
		}

		consola.info(`[Create Persona from ICP] Successfully created persona ${persona.id}`)

		// **AUTO-POPULATE**: Find all people who match these facets and link them
		const matchingPeople = await findPeopleMatchingFacets(supabase, projectId, facets)

		if (matchingPeople.length > 0) {
			consola.info(`[Create Persona from ICP] Found ${matchingPeople.length} people matching facets, linking...`)

			// Create people_personas junction records
			const junctionRecords = matchingPeople.map((person) => ({
				persona_id: persona.id,
				person_id: person.id,
			}))

			const { error: junctionError } = await supabase.from("people_personas").insert(junctionRecords)

			if (junctionError) {
				consola.error("[Create Persona from ICP] Error linking people:", junctionError)
				// Don't fail the whole operation, just warn
			} else {
				consola.info(`[Create Persona from ICP] Successfully linked ${matchingPeople.length} people to persona`)
			}
		}

		// Redirect to the new persona detail page
		return redirect(`/a/${accountId}/p/${projectId}/personas/${persona.id}`)
	} catch (error) {
		consola.error("[Create Persona from ICP] Error:", error)
		if (error instanceof Response) throw error
		throw new Response("Internal server error", { status: 500 })
	}
}
