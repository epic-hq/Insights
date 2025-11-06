import type { SupabaseClient } from "~/types"

/**
 * Derived user group - emergent from people attributes, not pre-defined
 */
export type DerivedGroup = {
	type: "role" | "segment" | "cohort"
	name: string
	description?: string
	criteria: {
		role_in?: string[]
		segment_in?: string[]
		company_size_in?: string[]
		behaviors_all?: string[]
		behaviors_any?: string[]
	}
	member_count: number
	member_ids: string[]
}

/**
 * Person with attributes for grouping
 */
type PersonWithAttributes = {
	id: string
	name: string | null
	role: string | null
	segment: string | null
	company: string | null
	company_size: string | null
	// Future: behaviors from evidence analysis
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
	minGroupSize?: number
}): Promise<DerivedGroup[]> {
	const { supabase, projectId, minGroupSize = 2 } = opts

	// Load all people with attributes (company_size column may not exist yet)
	const { data: people, error } = await supabase
		.from("people")
		.select("id, name, role, segment, company")
		.eq("project_id", projectId)

	if (error) throw error
	if (!people || people.length === 0) return []

	const groups: DerivedGroup[] = []

	// Group by role
	const byRole = groupByAttribute(people as PersonWithAttributes[], "role", minGroupSize)
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

	// Group by segment
	const bySegment = groupByAttribute(people as PersonWithAttributes[], "segment", minGroupSize)
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

	// TODO: Group by company size when column is added to schema
	// const byCompanySize = groupByAttribute(people as PersonWithAttributes[], "company_size", minGroupSize)
	// groups.push(
	// 	...byCompanySize.map((g) => ({
	// 		type: "segment" as const,
	// 		name: `${g.name} companies`,
	// 		description: `People from ${g.name} companies`,
	// 		criteria: { company_size_in: [g.name] },
	// 		member_count: g.members.length,
	// 		member_ids: g.members.map((m) => m.id),
	// 	}))
	// )

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
