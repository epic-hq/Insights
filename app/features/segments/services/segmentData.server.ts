import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/database.types"

type DbClient = SupabaseClient<Database>

export const SEGMENT_KIND_SLUGS = [
	"persona",
	"job_function",
	"seniority_level",
	"title",
	"industry",
	"life_stage",
	"age_range",
]

export const SEGMENT_KIND_LABELS: Record<string, string> = {
	persona: "Personas",
	job_function: "Job Functions",
	seniority_level: "Seniority Levels",
	title: "Job Titles",
	industry: "Industries",
	life_stage: "Life Stages",
	age_range: "Age Ranges",
}

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

async function getProjectAccountId(supabase: DbClient, projectId: string) {
	const { data: project, error } = await supabase.from("projects").select("account_id").eq("id", projectId).single()

	if (error || !project) {
		consola.error(`[segmentData] Unable to find project ${projectId}`, error)
		throw new Error("Project not found")
	}

	return project.account_id
}

export interface SegmentKindSummary {
	kind: string
	label: string
	person_count: number
}

export async function getSegmentKindSummaries(supabase: DbClient, projectId: string): Promise<SegmentKindSummary[]> {
	const accountId = await getProjectAccountId(supabase, projectId)

	const { data: segmentKinds, error: segmentKindsError } = await supabase
		.from("facet_kind_global")
		.select("id, slug")
		.in("slug", SEGMENT_KIND_SLUGS)

	if (segmentKindsError) {
		consola.error("[getSegmentKindSummaries] Error fetching kinds", segmentKindsError)
		throw segmentKindsError
	}

	const segmentKindIds = segmentKinds?.map((k) => k.id) ?? []

	if (segmentKindIds.length === 0) {
		return SEGMENT_KIND_SLUGS.map((slug) => ({
			kind: slug,
			label: SEGMENT_KIND_LABELS[slug] || slug,
			person_count: 0,
		}))
	}

	const { data: segmentFacets, error: segmentFacetsError } = await supabase
		.from("facet_account")
		.select(
			`
			id,
			kind_id,
			facet_kind_global!inner(slug)
		`
		)
		.eq("account_id", accountId)
		.in("kind_id", segmentKindIds)

	if (segmentFacetsError) {
		consola.error("[getSegmentKindSummaries] Error fetching facets", segmentFacetsError)
		throw segmentFacetsError
	}

	const facetIds = (segmentFacets || []).map((facet) => facet.id)
	const facetKindLookup = new Map<number, string>()

	for (const facet of segmentFacets || []) {
		const facetKind = facet.facet_kind_global
		const slug = facetKind && typeof facetKind === "object" && "slug" in facetKind ? String(facetKind.slug) : undefined
		if (slug) {
			facetKindLookup.set(facet.id, slug)
		}
	}

	const kindPeopleCounts = new Map<string, Set<string>>()

	if (facetIds.length > 0) {
		const { data: personFacets, error: personFacetsError } = await supabase
			.from("person_facet")
			.select("person_id, facet_account_id")
			.in("facet_account_id", facetIds)
			.eq("project_id", projectId)

		if (personFacetsError) {
			consola.error("[getSegmentKindSummaries] Error fetching person facets", personFacetsError)
			throw personFacetsError
		}

		for (const pf of personFacets || []) {
			const kindSlug = facetKindLookup.get(pf.facet_account_id)
			if (!kindSlug) continue
			if (!kindPeopleCounts.has(kindSlug)) {
				kindPeopleCounts.set(kindSlug, new Set())
			}
			kindPeopleCounts.get(kindSlug)?.add(pf.person_id)
		}
	}

	return SEGMENT_KIND_SLUGS.map((slug) => ({
		kind: slug,
		label: SEGMENT_KIND_LABELS[slug] || slug,
		person_count: kindPeopleCounts.get(slug)?.size ?? 0,
	}))
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

	const accountId = await getProjectAccountId(supabase, projectId)

	// Get segment kind IDs
	const { data: segmentKinds, error: segmentKindsError } = await supabase
		.from("facet_kind_global")
		.select("id, slug")
		.in("slug", SEGMENT_KIND_SLUGS)

	if (segmentKindsError) {
		consola.error("[getSegmentsSummary] Error fetching kinds", segmentKindsError)
		throw segmentKindsError
	}

	const segmentKindIds = segmentKinds?.map((k) => k.id) ?? []

	if (segmentKindIds.length === 0) {
		return []
	}

	// Step 1: Fetch all facet_account records for this account
	const { data: facets, error: facetsError } = await supabase
		.from("facet_account")
		.select("id, kind_id, slug, label, facet_kind_global!inner(slug)")
		.eq("account_id", accountId)
		.in("kind_id", segmentKindIds)

	if (facetsError) {
		consola.error("[getSegmentsSummary] Error fetching facets:", facetsError)
		throw facetsError
	}

	if (!facets || facets.length === 0) {
		consola.info("[getSegmentsSummary] No facets found for account")
		return []
	}

	// Build lookup map for facet kind slugs
	const facetKindLookup = new Map<number, string>()
	for (const facet of facets) {
		const facetKind = facet.facet_kind_global
		const slug = facetKind && typeof facetKind === "object" && "slug" in facetKind ? String(facetKind.slug) : undefined
		if (slug) {
			facetKindLookup.set(facet.id, slug)
		}
	}

	const facetIds = facets.map((f) => f.id)

	// Step 2: Fetch person_facet records for this project
	const { data: personFacets, error: personFacetsError } = await supabase
		.from("person_facet")
		.select("person_id, facet_account_id")
		.in("facet_account_id", facetIds)
		.eq("project_id", projectId)

	if (personFacetsError) {
		consola.error("[getSegmentsSummary] Error fetching person facets:", personFacetsError)
		throw personFacetsError
	}

	// Build map of facet -> people
	const facetPeopleMap = new Map<number, Set<string>>()
	for (const pf of personFacets || []) {
		if (!facetPeopleMap.has(pf.facet_account_id)) {
			facetPeopleMap.set(pf.facet_account_id, new Set())
		}
		facetPeopleMap.get(pf.facet_account_id)?.add(pf.person_id)
	}

	// Step 3: Get unique people IDs across all facets
	const allPeopleIds = new Set<string>()
	for (const peopleSet of facetPeopleMap.values()) {
		for (const personId of peopleSet) {
			allPeopleIds.add(personId)
		}
	}

	if (allPeopleIds.size === 0) {
		consola.info("[getSegmentsSummary] No people found for facets in this project")
		return []
	}

	// Step 4: Fetch evidence for all people in batches
	const peopleIdsArray = Array.from(allPeopleIds)
	const { data: evidenceLinks, error: evidenceError } = await supabase
		.from("evidence_people")
		.select(
			`
      person_id,
      evidence:evidence!inner(
        id,
        does,
        feels,
        gains,
        pains,
        project_id
      )
    `
		)
		.in("person_id", peopleIdsArray)
		.eq("evidence.project_id", projectId)

	if (evidenceError) {
		consola.error("[getSegmentsSummary] Error fetching evidence:", evidenceError)
		throw evidenceError
	}

	// Build map of person -> evidence
	const personEvidenceMap = new Map<string, Evidence[]>()
	for (const link of evidenceLinks || []) {
		const evidence = (link as any).evidence as Evidence
		if (!evidence) continue

		if (!personEvidenceMap.has(link.person_id)) {
			personEvidenceMap.set(link.person_id, [])
		}
		personEvidenceMap.get(link.person_id)?.push(evidence)
	}

	// Step 5: Calculate metrics for each segment
	const segments: SegmentSummary[] = []

	for (const facet of facets) {
		const kindSlug = facetKindLookup.get(facet.id) || "unknown"

		if (options.kind && kindSlug !== options.kind) {
			continue
		}

		const peopleInSegment = facetPeopleMap.get(facet.id)
		if (!peopleInSegment || peopleInSegment.size === 0) {
			continue
		}

		let evidenceCount = 0
		let highWtpCount = 0
		let totalIntensity = 0
		let intensityCount = 0

		// Process evidence for each person in this segment
		for (const personId of peopleInSegment) {
			const evidenceList = personEvidenceMap.get(personId) || []

			for (const evidence of evidenceList) {
				evidenceCount++

				// Estimate WTP from evidence fields
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

		const person_count = peopleInSegment.size
		const avg_pain_intensity = intensityCount > 0 ? totalIntensity / intensityCount : 0

		const bullseye_score = calculateBullseyeScore({
			person_count,
			evidence_count: evidenceCount,
			high_willingness_to_pay_count: highWtpCount,
			avg_pain_intensity,
		})

		if (options.minBullseyeScore === undefined || bullseye_score >= options.minBullseyeScore) {
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
