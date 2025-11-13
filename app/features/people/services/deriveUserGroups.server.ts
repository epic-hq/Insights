import type { SupabaseClient } from "~/types"

/**
 * Facet kinds that represent user segments
 *
 * DEMOGRAPHIC FACETS (who they are):
 * - persona, job_function, seniority_level, title, industry, life_stage, age_range
 * - Always included, any group size
 *
 * BEHAVIORAL FACETS (what they use/do/value):
 * - tool, workflow, preference, value
 * - Only included if 2+ people share the same facet (e.g., "Notion Users")
 * - Filtered by minGroupSize in deriveUserGroups
 */
export const SEGMENT_FACET_KINDS = [
	// Always include demographics (any size)
	"persona",
	"job_function",
	"seniority_level",
	"title",
	"industry",
	"life_stage",
	"age_range",
	// Include behavioral only if 2+ people (filtered by minGroupSize)
	"tool",
	"workflow",
	"preference",
	"value",
]

/**
 * Derived user group - emergent from people attributes, not pre-defined
 */
export type DerivedGroup = {
	type: "role" | "title" | "segment" | "industry" | "org_size" | "org_industry" | "company_type" | "cohort"
	name: string
	description?: string
	criteria: {
		role_in?: string[]
		title_in?: string[]
		segment_in?: string[]
		industry_in?: string[]
		org_size_in?: string[]
		org_industry_in?: string[]
		company_type_in?: string[]
		behaviors_all?: string[]
		behaviors_any?: string[]
	}
	member_count: number
	member_ids: string[]
}

/**
 * Person with attributes for grouping (person attributes + linked organization attributes)
 */
type PersonWithAttributes = {
	id: string
	name: string | null
	// Person attributes
	role: string | null
	title: string | null
	segment: string | null
	industry: string | null
	occupation: string | null
	// Organization attributes (joined from default_organization_id)
	company: string | null
	org_size_range: string | null
	org_employee_count: number | null
	org_industry: string | null
	org_company_type: string | null
}

/**
 * Derive user groups from people attributes using rule-based clustering
 *
 * Phase 1: Simple grouping by role and segment
 * Phase 2: Add behavioral clustering with ML
 */
export async function deriveUserGroups(opts: {
	supabase: SupabaseClient
	projectId: string
	segmentId?: string // DEPRECATED: Filter by specific segment (facet_account_id)
	segmentKindSlug?: string // Filter by segment kind (e.g., "job_function", "life_stage")
	minGroupSize?: number
}): Promise<DerivedGroup[]> {
	const { supabase, projectId, segmentId, segmentKindSlug, minGroupSize = 2 } = opts

	// NEW APPROACH: Use person_facet junction table instead of deprecated columns
	// Get all people with their facets
	const { data: personFacets, error: facetError } = await supabase
		.from("person_facet")
		.select(
			`
      person_id,
      facet_account_id,
      facet:facet_account!inner(
        id,
        label,
        kind_id,
        facet_kind_global!inner(
          slug,
          label
        )
      )
    `
		)
		.eq("project_id", projectId)

	if (facetError) throw facetError
	if (!personFacets || personFacets.length === 0) return []

	// Filter facets to only include segment-type kinds (NOT pain, goal, workflow, etc.)
	const filteredFacets = personFacets.filter((pf: any) => {
		const kindSlug = pf.facet?.facet_kind_global?.slug

		// If specific segment kind requested, filter to that
		if (segmentKindSlug) {
			return kindSlug === segmentKindSlug
		}

		// Otherwise, only include segment-type facet kinds
		return SEGMENT_FACET_KINDS.includes(kindSlug)
	})

	// Group people by individual facet labels
	// TODO: Add semantic clustering to group similar labels intelligently
	const facetGroups = new Map<string, Set<string>>()

	for (const pf of filteredFacets) {
		const facetLabel = (pf.facet as any)?.label
		const kindSlug = (pf.facet as any)?.facet_kind_global?.slug

		if (!facetLabel || !kindSlug) continue

		// Group by specific facet label (e.g., "Nonprofit Professional", "uses Notion")
		const groupKey = `${kindSlug}:${facetLabel}`

		if (!facetGroups.has(groupKey)) {
			facetGroups.set(groupKey, new Set())
		}

		facetGroups.get(groupKey)!.add(pf.person_id)
	}

	// Convert to DerivedGroup format
	const groups: DerivedGroup[] = []

	// Behavioral facets that need 2+ people to be meaningful
	const behavioralFacets = ["tool", "workflow", "preference", "value"]

	for (const [groupKey, memberIds] of facetGroups.entries()) {
		const [kindSlug, facetLabel] = groupKey.split(":")

		// Smart filtering: demographics use minGroupSize, behavioral require 2+ minimum
		const effectiveMinSize = behavioralFacets.includes(kindSlug) ? Math.max(minGroupSize, 2) : minGroupSize

		if (memberIds.size < effectiveMinSize) continue

		groups.push({
			type: kindSlug as any,
			name: facetLabel,
			description: `People with ${kindSlug}: ${facetLabel}`,
			criteria: {},
			member_count: memberIds.size,
			member_ids: Array.from(memberIds),
		})
	}

	// Sort by largest groups first and return
	return groups.sort((a, b) => b.member_count - a.member_count)
}

/**
 * Get evidence count by user group
 */
export async function getEvidenceByGroup(opts: {
	supabase: SupabaseClient
	projectId: string
	group: DerivedGroup
}): Promise<number> {
	const { supabase, projectId, group } = opts

	// Count evidence where person_id is in group members
	const { count, error } = await supabase
		.from("evidence")
		.select("*", { count: "exact", head: true })
		.eq("project_id", projectId)
		.in("person_id", group.member_ids)

	if (error) throw error
	return count ?? 0
}

/**
 * Future: Behavioral clustering using evidence patterns
 * This will use embeddings and ML clustering (Phase 2)
 */
export async function derivePersonasFromBehaviors(_opts: {
	supabase: SupabaseClient
	projectId: string
	minClusterSize?: number
}): Promise<DerivedGroup[]> {
	// TODO: Phase 2 - cluster people by:
	// - Pain patterns (which pains they mention)
	// - Workflow patterns (tools they use, processes they follow)
	// - Goal patterns (what they're trying to achieve)
	// Using embeddings + k-means or hierarchical clustering
	return []
}
