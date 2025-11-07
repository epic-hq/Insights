import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/database.types"

type DbClient = SupabaseClient<Database>

// Define types for complex nested query results
interface Evidence {
	id: string
	does?: string[]
	feels?: string[]
	gains?: string[]
	pains?: string[]
	project_id: string
}

interface PersonEvidenceLink {
	evidence: Evidence
}

interface PersonWithEvidence {
	id: string
	evidence_people: PersonEvidenceLink[]
}

interface PersonFacetLink {
	person_id: string
	people: PersonWithEvidence
}

/**
 * Segment represents any user grouping (persona, role, industry, etc.)
 * that we use to understand customer attributes and buying behavior
 */
export interface Segment {
	id: string
	kind: string // 'persona', 'role', 'industry', etc.
	label: string
	definition: string | null
	// Metrics
	person_count: number
	evidence_count: number
	// Pain analysis
	top_pains: Array<{
		pain_theme: string
		impact_score: number
		frequency: number
		evidence_count: number
		evidence_ids: string[] // IDs of evidence containing this pain
	}>
	// Buying signals
	high_willingness_to_pay_count: number
	avg_pain_intensity: number
	// Related insights
	insight_count: number
}

export interface SegmentSummary {
	id: string
	kind: string
	label: string
	person_count: number
	evidence_count: number
	bullseye_score: number // 0-100 score indicating how "bullseye" this segment is
}

/**
 * Calculate "bullseye score" - how likely this segment is to buy
 * Based on: high WTP %, high pain intensity, sufficient sample size
 */
function calculateBullseyeScore(segment: {
	person_count: number
	evidence_count: number
	high_willingness_to_pay_count: number
	avg_pain_intensity: number
}): number {
	// Minimum viable sample (3+ people, 10+ evidence)
	const sampleSizeScore = Math.min(((segment.person_count / 3) * 30 + (segment.evidence_count / 10) * 20) / 2, 25)

	// Willingness to pay (0-40 points)
	const wtpScore =
		segment.evidence_count > 0 ? (segment.high_willingness_to_pay_count / segment.evidence_count) * 40 : 0

	// Pain intensity (0-35 points)
	const painScore = segment.avg_pain_intensity * 35

	return Math.round(sampleSizeScore + wtpScore + painScore)
}

/**
 * Get all segments in a project with bullseye scores
 */
export async function getSegmentsSummary(
	supabase: DbClient,
	projectId: string,
	options: {
		kind?: string // Filter by kind slug
		minBullseyeScore?: number // Filter by score
	} = {}
): Promise<SegmentSummary[]> {
	consola.info("[getSegmentsSummary] Fetching segments for project", projectId)

	// If filtering by kind, get the kind_id from facet_kind_global by slug
	let kindIdFilter: number | undefined
	if (options.kind) {
		const { data: kindData } = await supabase
			.from("facet_kind_global")
			.select("id")
			.eq("slug", options.kind)
			.single()

		if (kindData) {
			kindIdFilter = kindData.id
		}
	}

	// Get all facet_account entries with their kind slugs
	let query = supabase
		.from("facet_account")
		.select(
			`
      id,
      kind_id,
      slug,
      label,
      facet_kind_global!inner(slug),
      person_facet!inner(
        person:people!inner(
          id,
          evidence_people(
            evidence:evidence!inner(
              id,
              does,
              feels,
              gains,
              pains,
              project_id
            )
          )
        )
      )
    `
		)
		.eq("person_facet.person.evidence_people.evidence.project_id", projectId)

	if (kindIdFilter) {
		query = query.eq("kind_id", kindIdFilter)
	}

	const { data: facets, error } = await query

	if (error) {
		consola.error("[getSegmentsSummary] Error fetching facets:", error)
		throw error
	}

	if (!facets) return []

	// Calculate metrics for each segment
	const segments: SegmentSummary[] = []

	for (const facet of facets) {
		// Get unique people in this segment
		const peopleIds = new Set<string>()
		let evidenceCount = 0
		let highWtpCount = 0
		let totalIntensity = 0
		let intensityCount = 0

		// This is a complex nested structure, need to traverse it carefully
		const personFacetLinks: Array<{
			person: { id: string; evidence_people: Array<{ evidence: Evidence }> }
		}> = facet.person_facet as unknown as Array<{
			person: { id: string; evidence_people: Array<{ evidence: Evidence }> }
		}>

		for (const link of personFacetLinks) {
			if (!link.person) continue
			peopleIds.add(link.person.id)

			// Get evidence for this person
			const personEvidenceLinks = link.person.evidence_people || []
			for (const personLink of personEvidenceLinks) {
				if (!personLink.evidence) continue
				evidenceCount++

				const evidence = personLink.evidence
				// Estimate WTP from evidence fields (simplistic approach)
				const hasHighWtp = evidence.gains?.some((g: string) => g.toLowerCase().includes("pay")) ?? false
				if (hasHighWtp) highWtpCount++

				// Estimate intensity from pains field
				const painCount = evidence.pains?.length ?? 0
				if (painCount > 0) {
					totalIntensity += Math.min(painCount / 3, 1) // Normalize
					intensityCount++
				}
			}
		}

		const person_count = peopleIds.size
		const avg_pain_intensity = intensityCount > 0 ? totalIntensity / intensityCount : 0

		const bullseye_score = calculateBullseyeScore({
			person_count,
			evidence_count: evidenceCount,
			high_willingness_to_pay_count: highWtpCount,
			avg_pain_intensity,
		})

		if (options.minBullseyeScore === undefined || bullseye_score >= options.minBullseyeScore) {
			// Get kind slug from joined facet_kind_global
			const kindSlug = (facet as any).facet_kind_global?.slug || "unknown"

			segments.push({
				id: facet.id.toString(),
				kind: kindSlug,
				label: facet.label,
				person_count,
				evidence_count: evidenceCount,
				bullseye_score,
			})
		}
	}

	// Sort by bullseye score descending
	segments.sort((a, b) => b.bullseye_score - a.bullseye_score)

	consola.success(
		`[getSegmentsSummary] Found ${segments.length} segments, top score: ${segments[0]?.bullseye_score ?? 0}`
	)

	return segments
}

/**
 * Get detailed data for a single segment
 */
export async function getSegmentDetail(supabase: DbClient, facetId: string): Promise<Segment | null> {
	consola.info("[getSegmentDetail] Fetching segment", facetId)

	// Get the facet_account entry with kind slug (id is an integer in the database)
	const { data: facet, error: facetError } = await supabase
		.from("facet_account")
		.select("id, kind_id, slug, label, description, facet_kind_global!inner(slug)")
		.eq("id", Number.parseInt(facetId, 10))
		.single()

	if (facetError || !facet) {
		consola.error("[getSegmentDetail] Error fetching facet:", facetError)
		return null
	}

	// Get people with this facet
	const { data: personLinks, error: personError } = await supabase
		.from("person_facet")
		.select(
			`
      person_id,
      people!inner(
        id,
        evidence_people(
          evidence:evidence!inner(
            id,
            does,
            feels,
            gains,
            pains
          )
        )
      )
    `
		)
		.eq("facet_account_id", facet.id)

	if (personError) {
		consola.error("[getSegmentDetail] Error fetching person links:", personError)
		return null
	}

	// Calculate metrics
	const peopleIds = new Set<string>()
	let evidenceCount = 0
	let highWtpCount = 0
	let totalIntensity = 0
	let intensityCount = 0
	const painCounts = new Map<string, number>()
	const painEvidenceIds = new Map<string, Set<string>>()

	for (const link of (personLinks as PersonFacetLink[]) || []) {
		if (!link.people) continue
		peopleIds.add(link.people.id)

		// Get evidence for this person
		const personEvidenceLinks: PersonEvidenceLink[] = link.people.evidence_people || []
		for (const personLink of personEvidenceLinks) {
			if (!personLink.evidence) continue
			evidenceCount++

			const evidence = personLink.evidence

			// WTP signals
			const hasHighWtp = evidence.gains?.some((g: string) => g.toLowerCase().includes("pay")) ?? false
			if (hasHighWtp) highWtpCount++

			// Pain intensity
			const painCount = evidence.pains?.length ?? 0
			if (painCount > 0) {
				totalIntensity += Math.min(painCount / 3, 1)
				intensityCount++
			}

			// Track pain themes and their evidence IDs
			for (const pain of evidence.pains || []) {
				painCounts.set(pain, (painCounts.get(pain) || 0) + 1)
				if (!painEvidenceIds.has(pain)) {
					painEvidenceIds.set(pain, new Set())
				}
				painEvidenceIds.get(pain)?.add(evidence.id)
			}
		}
	}

	// Top pains (simplified - real implementation should use pain matrix data)
	const top_pains = Array.from(painCounts.entries())
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([pain, count]) => ({
			pain_theme: pain,
			impact_score: (count / evidenceCount) * peopleIds.size,
			frequency: count / peopleIds.size,
			evidence_count: count,
			evidence_ids: Array.from(painEvidenceIds.get(pain) || []),
		}))

	// Get insight count
	const { count: insightCount } = await supabase
		.from("insights")
		.select("*", { count: "exact", head: true })
		.contains("tags", [facet.label])

	// Get kind slug from joined facet_kind_global
	const kindSlug = (facet as any).facet_kind_global?.slug || "unknown"

	const segment: Segment = {
		id: facet.id.toString(),
		kind: kindSlug,
		label: facet.label,
		definition: facet.description,
		person_count: peopleIds.size,
		evidence_count: evidenceCount,
		top_pains,
		high_willingness_to_pay_count: highWtpCount,
		avg_pain_intensity: intensityCount > 0 ? totalIntensity / intensityCount : 0,
		insight_count: insightCount ?? 0,
	}

	consola.success(`[getSegmentDetail] Loaded segment ${segment.label} with ${segment.person_count} people`)

	return segment
}
