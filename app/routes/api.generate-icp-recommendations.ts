import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"

interface ICPRecommendation {
	name: string
	facets: {
		person: Record<string, any>
		org: Record<string, any>
	}
	stats: {
		count: number
		bullseye_avg: number | null
		top_pains: string[]
	}
}

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub

		if (!accountId) {
			consola.error("[ICP Recommendations API] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		const formData = await request.formData()
		const projectId = formData.get("projectId") as string

		if (!projectId) {
			throw new Response("Missing projectId", { status: 400 })
		}

		consola.info(`[ICP Recommendations API] Generating recommendations for project ${projectId}`)

		// Calculate ICP recommendations based on person facets, org facets, and pain data
		const recommendations = await generateICPRecommendations(supabase, projectId)

		// Upsert into icp_recommendations table
		const { error: upsertError } = await supabase
			.from("icp_recommendations")
			.upsert(
				{
					project_id: projectId,
					recommendations: recommendations as any,
					generated_at: new Date().toISOString(),
					generated_by_user_id: accountId,
				},
				{
					onConflict: "project_id",
				}
			)

		if (upsertError) {
			consola.error("[ICP Recommendations API] Failed to store recommendations:", upsertError)
			throw new Response("Failed to store recommendations", { status: 500 })
		}

		consola.info(`[ICP Recommendations API] Successfully generated ${recommendations.length} recommendations`)

		return {
			success: true,
			recommendations,
		}
	} catch (error) {
		consola.error("[ICP Recommendations API] Error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

async function generateICPRecommendations(supabase: any, projectId: string): Promise<ICPRecommendation[]> {
	// 1. Get account ID for this project
	const { data: project, error: projectError } = await supabase
		.from("projects")
		.select("account_id")
		.eq("id", projectId)
		.single()

	if (projectError || !project) {
		consola.error("[ICP Recommendations] Error fetching project:", projectError)
		throw new Error("Failed to fetch project")
	}

	const accountId = project.account_id

	// 2. Get all facets for this account
	const { data: facets, error: facetsError } = await supabase
		.from("facet_account")
		.select("id, label, kind_id, facet_kind_global!inner(slug)")
		.eq("account_id", accountId)

	if (facetsError) {
		consola.error("[ICP Recommendations] Error fetching facets:", facetsError)
		throw new Error("Failed to fetch facets")
	}

	if (!facets || facets.length === 0) {
		consola.warn("[ICP Recommendations] No facets found")
		return []
	}

	// 3. Get person-facet links for this project
	const facetIds = facets.map((f) => f.id)
	const { data: personFacets, error: personFacetsError } = await supabase
		.from("person_facet")
		.select("person_id, facet_account_id")
		.in("facet_account_id", facetIds)
		.eq("project_id", projectId)

	if (personFacetsError) {
		consola.error("[ICP Recommendations] Error fetching person facets:", personFacetsError)
		throw new Error("Failed to fetch person facets")
	}

	// 4. Build person -> facets map
	const personFacetsMap = new Map<string, Set<number>>()
	for (const pf of personFacets || []) {
		if (!personFacetsMap.has(pf.person_id)) {
			personFacetsMap.set(pf.person_id, new Set())
		}
		personFacetsMap.get(pf.person_id)?.add(pf.facet_account_id)
	}

	// 5. Group people by facet combinations
	const facetCombinations = new Map<string, Set<string>>()
	for (const [personId, facetSet] of personFacetsMap.entries()) {
		const facetKey = Array.from(facetSet)
			.sort()
			.join(",")
		if (!facetCombinations.has(facetKey)) {
			facetCombinations.set(facetKey, new Set())
		}
		facetCombinations.get(facetKey)?.add(personId)
	}

	// 6. Get evidence for bullseye calculation
	const allPeopleIds = Array.from(personFacetsMap.keys())
	const { data: evidenceLinks, error: evidenceError } = await supabase
		.from("evidence_people")
		.select("person_id, evidence:evidence!inner(id, pains, gains)")
		.in("person_id", allPeopleIds)
		.eq("evidence.project_id", projectId)

	if (evidenceError) {
		consola.error("[ICP Recommendations] Error fetching evidence:", evidenceError)
	}

	// Build person -> evidence map
	const personEvidenceMap = new Map<string, any[]>()
	for (const link of evidenceLinks || []) {
		const evidence = (link as any).evidence
		if (!evidence) continue
		if (!personEvidenceMap.has(link.person_id)) {
			personEvidenceMap.set(link.person_id, [])
		}
		personEvidenceMap.get(link.person_id)?.push(evidence)
	}

	// 7. Get pain themes for context
	const { data: themes, error: themesError } = await supabase
		.from("themes")
		.select("theme_name, pain")
		.eq("project_id", projectId)
		.order("pain", { ascending: false })
		.limit(5)

	const topPainThemes = (themes || []).map((t) => t.theme_name)

	// 8. Calculate bullseye score for each facet combination
	const icpCandidates: ICPRecommendation[] = []

	for (const [facetKey, peopleSet] of facetCombinations.entries()) {
		const facetIds = facetKey.split(",").map(Number)
		const facetLabels = facetIds.map((id) => facets.find((f) => f.id === id)).filter(Boolean)

		// Calculate metrics
		const person_count = peopleSet.size
		let evidence_count = 0
		let high_wtp_count = 0
		let total_intensity = 0
		let intensity_count = 0

		for (const personId of peopleSet) {
			const evidenceList = personEvidenceMap.get(personId) || []
			for (const evidence of evidenceList) {
				evidence_count++

				// Estimate WTP
				const hasHighWtp = evidence.gains?.some((g: string) => g.toLowerCase().includes("pay")) ?? false
				if (hasHighWtp) high_wtp_count++

				// Estimate pain intensity
				const painCount = evidence.pains?.length ?? 0
				if (painCount > 0) {
					total_intensity += Math.min(painCount / 3, 1)
					intensity_count++
				}
			}
		}

		const avg_pain_intensity = intensity_count > 0 ? total_intensity / intensity_count : 0

		// Calculate bullseye score (same formula as segments)
		const sampleSizeScore = Math.min(((person_count / 3) * 30 + (evidence_count / 10) * 20) / 2, 25)
		const wtpScore = evidence_count > 0 ? (high_wtp_count / evidence_count) * 40 : 0
		const painScore = avg_pain_intensity * 35
		const bullseye_score = Math.round(sampleSizeScore + wtpScore + painScore)

		// Generate name from facet labels
		const name = facetLabels.map((f: any) => f.label).join(" + ") || "Unnamed Segment"

		// Organize facets by kind
		const facetsByKind: Record<string, string> = {}
		for (const facet of facetLabels) {
			const kind = (facet as any).facet_kind_global?.slug
			if (kind) {
				facetsByKind[kind] = (facet as any).label
			}
		}

		icpCandidates.push({
			name,
			facets: {
				person: facetsByKind,
				org: {}, // Will be populated when we add org facets
			},
			stats: {
				count: person_count,
				bullseye_avg: bullseye_score,
				top_pains: topPainThemes.slice(0, 2),
			},
		})
	}

	// 9. Sort by bullseye × log(count) and return top 5
	const topRecommendations = icpCandidates
		.filter((icp) => icp.stats.count >= 2)
		.sort((a, b) => {
			const scoreA = (a.stats.bullseye_avg || 0) * Math.log(a.stats.count + 1)
			const scoreB = (b.stats.bullseye_avg || 0) * Math.log(b.stats.count + 1)
			return scoreB - scoreA
		})
		.slice(0, 5)

	return topRecommendations
}

