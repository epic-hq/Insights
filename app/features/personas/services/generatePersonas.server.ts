import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { b } from "~/../baml_client"
import type { Persona } from "~/../baml_client/types"

/**
 * Persona cluster derived from shared facets
 */
interface PersonaCluster {
	people_ids: string[]
	shared_facets: Array<{
		kind_slug: string
		label: string
		facet_id: number
	}>
	pains: string[]
	goals: string[]
	behaviors: string[]
	quotes: string[]
	scales: Record<string, number> // avg scale scores
	size: number
}

/**
 * Step 1: Cluster people by shared facets
 * Groups people who have similar facet combinations (job function, preferences, values)
 */
async function clusterPeopleByFacets(supabase: SupabaseClient, projectId: string): Promise<PersonaCluster[]> {
	consola.info("[Persona Generation] Step 1: Clustering people by shared facets")

	// Get all person facets for behavioral/demographic clustering
	const { data: personFacets, error } = await supabase
		.from("person_facet")
		.select(
			`
			person_id,
			facet_account_id,
			facet_account!inner(
				id,
				label,
				facet_kind_global!inner(slug)
			)
		`
		)
		.eq("project_id", projectId)
		.in("facet_account.facet_kind_global.slug", [
			"job_function",
			"seniority_level",
			"persona",
			"preference",
			"value",
			"tool",
			"workflow",
		])

	if (error || !personFacets) {
		consola.error("[Persona Generation] Error fetching person facets:", error)
		return []
	}

	consola.info(`[Persona Generation] Found ${personFacets.length} person facet links`)

	// Build person -> facets map
	const personFacetsMap = new Map<string, Array<{ id: number; label: string; kind: string }>>()
	for (const pf of personFacets) {
		const facetInfo = pf.facet_account as any
		if (!personFacetsMap.has(pf.person_id)) {
			personFacetsMap.set(pf.person_id, [])
		}
		personFacetsMap.get(pf.person_id)?.push({
			id: facetInfo.id,
			label: facetInfo.label,
			kind: facetInfo.facet_kind_global.slug,
		})
	}

	// Group people by their facet combinations (exact match)
	const facetCombinationMap = new Map<string, Set<string>>()
	const facetCombinationDetails = new Map<string, Array<{ id: number; label: string; kind: string }>>()

	for (const [personId, facets] of personFacetsMap.entries()) {
		// Sort facets by ID to ensure consistent key
		const sortedFacets = facets.sort((a, b) => a.id - b.id)
		const key = sortedFacets.map((f) => f.id).join(",")

		if (!facetCombinationMap.has(key)) {
			facetCombinationMap.set(key, new Set())
			facetCombinationDetails.set(key, sortedFacets)
		}
		facetCombinationMap.get(key)?.add(personId)
	}

	consola.info(`[Persona Generation] Found ${facetCombinationMap.size} unique facet combinations`)

	// Create clusters from facet combinations with 1+ people
	const clusters: PersonaCluster[] = []
	for (const [key, peopleSet] of facetCombinationMap.entries()) {
		if (peopleSet.size >= 1) {
			const facets = facetCombinationDetails.get(key)!
			clusters.push({
				people_ids: Array.from(peopleSet),
				shared_facets: facets.map((f) => ({
					kind_slug: f.kind,
					label: f.label,
					facet_id: f.id,
				})),
				pains: [],
				goals: [],
				behaviors: [],
				quotes: [],
				scales: {},
				size: peopleSet.size,
			})
		}
	}

	// De-duplicate clusters with identical people
	const deduped = deduplicateClusters(clusters)

	consola.info(
		`[Persona Generation] Created ${deduped.length} clusters after deduplication (from ${clusters.length} raw clusters)`
	)
	return deduped
}

/**
 * De-duplicate clusters that have the same or very similar people
 */
function deduplicateClusters(clusters: PersonaCluster[]): PersonaCluster[] {
	const result: PersonaCluster[] = []
	const usedPeopleSignatures = new Set<string>()

	// Sort by size descending so we keep larger clusters
	const sorted = clusters.sort((a, b) => b.size - a.size)

	for (const cluster of sorted) {
		// Create signature from sorted people IDs
		const signature = cluster.people_ids.sort().join(",")

		if (!usedPeopleSignatures.has(signature)) {
			usedPeopleSignatures.add(signature)
			result.push(cluster)
		} else {
			consola.info(
				`[Persona Generation] Skipping duplicate cluster with ${cluster.size} people (facets: ${cluster.shared_facets.map((f) => f.label).join(", ")})`
			)
		}
	}

	return result
}

/**
 * Step 2: Aggregate evidence for each cluster
 * Collects pains, goals, behaviors, and quotes from evidence linked to cluster members
 * OPTIMIZED: Uses evidence_facet.person_id directly instead of evidence_people junction table
 */
async function aggregateEvidenceForClusters(
	supabase: SupabaseClient,
	projectId: string,
	clusters: PersonaCluster[]
): Promise<PersonaCluster[]> {
	consola.info("[Persona Generation] Step 2: Aggregating evidence for each cluster (using person_id directly)")

	for (const cluster of clusters) {
		// OPTIMIZED: Query evidence_facet directly with person_id filter
		// This replaces the two-step query via evidence_people junction table
		const { data: evidenceFacets } = await supabase
			.from("evidence_facet")
			.select(
				`
				evidence_id,
				kind_slug,
				label,
				person_id
			`
			)
			.eq("project_id", projectId)
			.in("person_id", cluster.people_ids)
			.in("kind_slug", ["pain", "goal", "behavior", "task"])

		if (!evidenceFacets || evidenceFacets.length === 0) continue

		const evidenceIds = [...new Set(evidenceFacets.map((ef) => ef.evidence_id))]

		// Group by kind
		const pains = new Set<string>()
		const goals = new Set<string>()
		const behaviors = new Set<string>()

		for (const ef of evidenceFacets || []) {
			if (ef.kind_slug === "pain") pains.add(ef.label)
			if (ef.kind_slug === "goal") goals.add(ef.label)
			if (ef.kind_slug === "behavior" || ef.kind_slug === "task") behaviors.add(ef.label)
		}

		cluster.pains = Array.from(pains).slice(0, 5)
		cluster.goals = Array.from(goals).slice(0, 5)
		cluster.behaviors = Array.from(behaviors).slice(0, 5)

		// Get quotes from evidence
		const { data: evidence } = await supabase.from("evidence").select("quote, verbatim").in("id", evidenceIds).limit(10)

		cluster.quotes =
			evidence
				?.map((e) => e.quote || e.verbatim)
				.filter(Boolean)
				.slice(0, 3) || []

		// Get average scale scores
		const { data: scales } = await supabase
			.from("person_scale")
			.select("kind_slug, score")
			.in("person_id", cluster.people_ids)

		const scaleGroups = new Map<string, number[]>()
		for (const scale of scales || []) {
			if (!scaleGroups.has(scale.kind_slug)) {
				scaleGroups.set(scale.kind_slug, [])
			}
			scaleGroups.get(scale.kind_slug)?.push(scale.score)
		}

		for (const [kind, scores] of scaleGroups.entries()) {
			cluster.scales[kind] = scores.reduce((a, b) => a + b, 0) / scores.length
		}
	}

	consola.info(
		`[Persona Generation] Aggregated evidence for ${clusters.length} clusters`,
		clusters.map((c) => ({
			size: c.size,
			pains: c.pains.length,
			goals: c.goals.length,
			quotes: c.quotes.length,
		}))
	)

	return clusters
}

/**
 * Step 3: Generate persona descriptions using AI
 * Takes cluster data and creates compelling persona profiles
 */
async function generatePersonaDescriptions(clusters: PersonaCluster[]): Promise<
	Array<{
		cluster: PersonaCluster
		persona: Partial<Persona>
	}>
> {
	consola.info(`[Persona Generation] Step 3: Generating AI descriptions for ${clusters.length} clusters (in parallel)`)

	// Generate all personas in parallel for speed
	const promises = clusters.map(async (cluster) => {
		const context = `
Cluster Size: ${cluster.size} people

Shared Attributes: ${cluster.shared_facets.map((f) => f.label).join(", ")}

Top Pains:
${cluster.pains.map((p) => `• ${p}`).join("\n")}

Top Goals:
${cluster.goals.map((g) => `• ${g}`).join("\n")}

Key Behaviors:
${cluster.behaviors.map((b) => `• ${b}`).join("\n")}

Representative Quotes:
${cluster.quotes.map((q) => `"${q}"`).join("\n")}

Scale Scores:
${Object.entries(cluster.scales)
	.map(([kind, score]) => `${kind}: ${score.toFixed(2)}`)
	.join(", ")}
`

		try {
			// Use the existing Persona BAML schema with a simpler prompt
			const persona = await b.ExtractPersona(
				cluster.people_ids.join(", "),
				cluster.shared_facets.map((f) => f.label).join(", "),
				"", // interviews - not needed
				context // evidence context
			)

			consola.info(`[Persona Generation] Generated persona: ${persona.name}`)
			return { cluster, persona }
		} catch (error) {
			consola.error("[Persona Generation] Error generating persona for cluster:", error)
			return null
		}
	})

	const results = (await Promise.all(promises)).filter((r) => r !== null) as Array<{
		cluster: PersonaCluster
		persona: Partial<Persona>
	}>

	consola.info(`[Persona Generation] Generated ${results.length} persona descriptions`)

	// De-duplicate semantically similar personas
	const deduped = deduplicateSimilarPersonas(results)
	consola.info(`[Persona Generation] After semantic deduplication: ${deduped.length} personas (from ${results.length})`)

	return deduped
}

/**
 * De-duplicate personas with similar names or descriptions
 * e.g., "Inventory Balancer" and "Supply Juggler" might be the same archetype
 */
function deduplicateSimilarPersonas(
	personas: Array<{ cluster: PersonaCluster; persona: Partial<Persona> }>
): Array<{ cluster: PersonaCluster; persona: Partial<Persona> }> {
	const result: Array<{ cluster: PersonaCluster; persona: Partial<Persona> }> = []
	const usedNames = new Set<string>()

	consola.info(`[Persona Generation] Starting semantic deduplication on ${personas.length} personas`)

	for (const item of personas) {
		const nameLower = (item.persona.name?.toLowerCase() || "").trim()

		if (!nameLower) {
			consola.warn("[Persona Generation] Skipping persona with empty name")
			continue
		}

		// Check for exact duplicate first
		if (usedNames.has(nameLower)) {
			consola.info(`[Persona Generation] Skipping exact duplicate: "${item.persona.name}"`)
			continue
		}

		// Check if we already have a very similar name
		let isDuplicate = false
		for (const existingName of usedNames) {
			// Simple word overlap check
			const existingWords = new Set(existingName.split(/\s+/))
			const newWords = nameLower.split(/\s+/)
			const overlap = newWords.filter((w) => existingWords.has(w)).length

			// If 50%+ word overlap, consider it a duplicate
			if (overlap / newWords.length >= 0.5 && overlap >= 1) {
				isDuplicate = true
				consola.info(`[Persona Generation] Skipping similar persona "${item.persona.name}" (matches "${existingName}")`)
				break
			}
		}

		if (!isDuplicate) {
			usedNames.add(nameLower)
			result.push(item)
		}
	}

	consola.info(
		`[Persona Generation] Deduplication complete: ${result.length} unique personas (from ${personas.length})`
	)
	return result
}

/**
 * Step 4: Generate contrast personas (who NOT to target)
 */
async function generateContrastPersonas(corePersonas: Persona[]): Promise<Persona[]> {
	consola.info("[Persona Generation] Step 4: Generating contrast personas")

	const contrastPersonas: Persona[] = []

	// For now, generate one contrast persona representing the opposite of all core personas
	const coreTraits = {
		pains: corePersonas.flatMap((p) => p.pain_points || []),
		goals: corePersonas.flatMap((p) => p.goals || []),
		behaviors: corePersonas.flatMap((p) => p.behaviors_habits || []),
	}

	const contrastPrompt = `
Generate a CONTRAST persona - someone who would NOT be a good fit for this product.

Core personas have these traits:
Pains: ${coreTraits.pains.slice(0, 10).join(", ")}
Goals: ${coreTraits.goals.slice(0, 10).join(", ")}
Behaviors: ${coreTraits.behaviors.slice(0, 10).join(", ")}

Create a persona with OPPOSITE traits:
- Different pains (or no pain in this area)
- Different goals
- Different behaviors
- Low willingness to pay
- Would churn quickly

This helps us know who to AVOID targeting.
`

	try {
		const contrast = await b.ExtractPersona("", "", "", contrastPrompt)
		contrast.name = `⚠️ ${contrast.name} (Contrast - Avoid)`
		contrastPersonas.push(contrast)
		consola.info(`[Persona Generation] Generated contrast persona: ${contrast.name}`)
	} catch (error) {
		consola.error("[Persona Generation] Error generating contrast persona:", error)
	}

	return contrastPersonas
}

/**
 * Main function: Generate all personas for a project
 */
export async function generatePersonasForProject(
	supabase: SupabaseClient,
	projectId: string,
	accountId: string
): Promise<{
	personas: any[]
	people_links: Array<{ persona_id: string; person_id: string }>
}> {
	consola.info(`[Persona Generation] Starting for project ${projectId}`)

	// Step 1: Cluster people by shared facets
	const clusters = await clusterPeopleByFacets(supabase, projectId)

	if (clusters.length === 0) {
		consola.warn("[Persona Generation] No clusters found - need more people with facets")
		return { personas: [], people_links: [] }
	}

	// Step 2: Aggregate evidence for each cluster
	const enrichedClusters = await aggregateEvidenceForClusters(supabase, projectId, clusters)

	// Step 3: Generate AI descriptions
	const personaData = await generatePersonaDescriptions(enrichedClusters)

	// Step 4: Generate contrast personas
	const corePersonas = personaData.map((pd) => pd.persona as Persona)
	const contrastPersonas = await generateContrastPersonas(corePersonas)

	// Step 5: Prepare DB inserts
	const allPersonas = [...corePersonas, ...contrastPersonas]
	const personaInserts = allPersonas.map((persona) => ({
		account_id: accountId,
		project_id: projectId,
		name: persona.name || "Untitled Persona",
		description: persona.description,
		kind: persona.name?.includes("Contrast") ? "contrast" : "core",
		goals: persona.goals || [],
		pains: persona.pain_points || persona.frustrations || [],
		motivations: persona.motivations || [],
		values: persona.values || [],
		behaviors: persona.behaviors_habits || [],
		tools_used: persona.tools_used || [],
		quotes: persona.key_quotes || [],
		differentiators: persona.differentiators || [],
		color_hex: persona.color_hex,
		roles: persona.role ? [persona.role] : [],
		age: persona.age,
		gender: persona.gender,
		location: persona.location,
		education: persona.education,
		occupation: persona.occupation,
		tech_comfort_level: persona.tech_comfort_level,
	}))

	// Step 6: Create people links (only for core personas)
	const people_links: Array<{ persona_id: string; person_id: string }> = []
	for (let i = 0; i < personaData.length; i++) {
		const { cluster } = personaData[i]
		// Will be filled in after DB insert with actual persona IDs
		for (const person_id of cluster.people_ids) {
			people_links.push({
				persona_id: `PLACEHOLDER_${i}`, // Will be replaced after insert
				person_id,
			})
		}
	}

	consola.info(
		`[Persona Generation] Generated ${personaInserts.length} personas (${corePersonas.length} core, ${contrastPersonas.length} contrast)`
	)

	return { personas: personaInserts, people_links }
}
