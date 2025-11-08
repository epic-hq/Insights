import type { SupabaseClient } from "~/types"

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

	// Load all people with attributes + joined organization data
	// If segmentId is provided, only include people tagged with that segment
	let query = supabase
		.from("people")
		.select(`
			id,
			name,
			role,
			title,
			segment,
			industry,
			occupation,
			company,
			organizations:default_organization_id (
				size_range,
				employee_count,
				industry,
				company_type
			)${segmentId ? ",person_facet!inner(facet_account_id)" : ""}
		`)
		.eq("project_id", projectId)

	// Filter by segment if specified
	if (segmentId) {
		query = query.eq("person_facet.facet_account_id", Number.parseInt(segmentId, 10))
	}

	const { data: people, error } = await query

	if (error) throw error
	if (!people || people.length === 0) return []

	// Flatten organization data into person object
	const peopleWithOrgs: PersonWithAttributes[] = people.map((p: any) => ({
		id: p.id,
		name: p.name,
		role: p.role,
		title: p.title,
		segment: p.segment,
		industry: p.industry,
		occupation: p.occupation,
		company: p.company,
		org_size_range: p.organizations?.size_range ?? null,
		org_employee_count: p.organizations?.employee_count ?? null,
		org_industry: p.organizations?.industry ?? null,
		org_company_type: p.organizations?.company_type ?? null,
	}))

	const groups: DerivedGroup[] = []

	// If segment kind is specified, group by facets of that kind instead of old person attributes
	if (segmentKindSlug) {
		// Get facet kind ID
		const { data: kind } = await supabase.from("facet_kind_global").select("id").eq("slug", segmentKindSlug).single()

		if (!kind) return []

		// Get all facets of this kind
		const { data: facets } = await supabase.from("facet_account").select("id, label").eq("kind_id", kind.id)

		if (!facets || facets.length === 0) return []

		// For each facet, get people linked to it
		const facetIds = facets.map((f) => f.id)
		const { data: personFacets } = await supabase
			.from("person_facet")
			.select("person_id, facet_account_id")
			.in("facet_account_id", facetIds)
			.eq("project_id", projectId)

		// Group people by facet
		const facetGroups = new Map<number, string[]>()
		for (const pf of personFacets || []) {
			const existing = facetGroups.get(pf.facet_account_id) || []
			existing.push(pf.person_id)
			facetGroups.set(pf.facet_account_id, existing)
		}

		// Build groups from facets
		for (const facet of facets) {
			const memberIds = facetGroups.get(facet.id) || []
			if (memberIds.length >= minGroupSize) {
				groups.push({
					type: "segment",
					name: facet.label,
					description: `${facet.label}`,
					criteria: { segment_in: [facet.label] },
					member_count: memberIds.length,
					member_ids: memberIds,
				})
			}
		}

		return groups.sort((a, b) => b.member_count - a.member_count)
	}

	// Otherwise, use old person attribute grouping
	const byRole = groupByAttribute(peopleWithOrgs, "role", minGroupSize)
	groups.push(
		...byRole.map((g) => ({
			type: "role" as const,
			name: g.name,
			description: `People in ${g.name} role`,
			criteria: { role_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	const byTitle = groupByAttribute(peopleWithOrgs, "title", minGroupSize)
	groups.push(
		...byTitle.map((g) => ({
			type: "title" as const,
			name: g.name,
			description: `People with ${g.name} title`,
			criteria: { title_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	const bySegment = groupByAttribute(peopleWithOrgs, "segment", minGroupSize)
	groups.push(
		...bySegment.map((g) => ({
			type: "segment" as const,
			name: g.name,
			description: `${g.name} segment`,
			criteria: { segment_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	const byIndustry = groupByAttribute(peopleWithOrgs, "industry", minGroupSize)
	groups.push(
		...byIndustry.map((g) => ({
			type: "industry" as const,
			name: g.name,
			description: `People in ${g.name} industry`,
			criteria: { industry_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	// Group by organization attributes
	const byOrgSize = groupByAttribute(peopleWithOrgs, "org_size_range", minGroupSize)
	groups.push(
		...byOrgSize.map((g) => ({
			type: "org_size" as const,
			name: `${g.name} employees`,
			description: `People from companies with ${g.name} employees`,
			criteria: { org_size_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	const byOrgIndustry = groupByAttribute(peopleWithOrgs, "org_industry", minGroupSize)
	groups.push(
		...byOrgIndustry.map((g) => ({
			type: "org_industry" as const,
			name: `${g.name} (org)`,
			description: `People from ${g.name} organizations`,
			criteria: { org_industry_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	const byCompanyType = groupByAttribute(peopleWithOrgs, "org_company_type", minGroupSize)
	groups.push(
		...byCompanyType.map((g) => ({
			type: "company_type" as const,
			name: g.name,
			description: `People from ${g.name} companies`,
			criteria: { company_type_in: [g.name] },
			member_count: g.members.length,
			member_ids: g.members.map((m) => m.id),
		}))
	)

	// Filter out groups below minimum size
	return groups.filter((g) => g.member_count >= minGroupSize)
}

/**
 * Helper: Group people by a single attribute
 */
function groupByAttribute(
	people: PersonWithAttributes[],
	attr: keyof PersonWithAttributes,
	minSize: number
): Array<{ name: string; members: PersonWithAttributes[] }> {
	const groups = new Map<string, PersonWithAttributes[]>()

	for (const person of people) {
		const value = person[attr]
		if (!value || typeof value !== "string") continue

		const normalized = normalizeAttributeValue(value)
		if (!normalized) continue

		const existing = groups.get(normalized) ?? []
		existing.push(person)
		groups.set(normalized, existing)
	}

	return Array.from(groups.entries())
		.filter(([_, members]) => members.length >= minSize)
		.map(([name, members]) => ({ name, members }))
		.sort((a, b) => b.members.length - a.members.length) // Largest groups first
}

/**
 * Normalize attribute values for consistent grouping
 */
function normalizeAttributeValue(value: string): string | null {
	const cleaned = value.trim().toLowerCase()
	if (!cleaned || cleaned.length < 2) return null

	// Common role normalizations
	const roleAliases: Record<string, string> = {
		pm: "Product Manager",
		"product manager": "Product Manager",
		"product lead": "Product Manager",
		dev: "Developer",
		developer: "Developer",
		engineer: "Developer",
		"software engineer": "Developer",
		designer: "Designer",
		"ux designer": "Designer",
		"ui designer": "Designer",
		founder: "Founder",
		ceo: "Founder",
		"co-founder": "Founder",
	}

	// Segment normalizations
	const segmentAliases: Record<string, string> = {
		enterprise: "Enterprise",
		smb: "SMB",
		"small business": "SMB",
		startup: "Startup",
		"early-stage": "Startup",
	}

	// Company size normalizations
	const sizeAliases: Record<string, string> = {
		"1-10": "1-10",
		"11-50": "11-50",
		"51-200": "51-200",
		"201-500": "201-500",
		"501-1000": "501-1000",
		"1001+": "1001+",
		small: "1-50",
		medium: "51-500",
		large: "501+",
	}

	return roleAliases[cleaned] || segmentAliases[cleaned] || sizeAliases[cleaned] || capitalize(cleaned)
}

/**
 * Capitalize first letter of each word
 */
function capitalize(str: string): string {
	return str
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
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
