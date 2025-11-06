import consola from "consola"
import type { DerivedGroup } from "~/features/people/services/deriveUserGroups.server"
import { deriveUserGroups } from "~/features/people/services/deriveUserGroups.server"
import type { SupabaseClient } from "~/types"

/**
 * Pain theme derived from evidence clustering
 */
export type PainTheme = {
	id: string
	name: string
	description: string
	evidence_ids: string[]
	evidence_count: number
}

/**
 * Matrix cell showing how a specific pain affects a specific user group
 */
export type PainMatrixCell = {
	pain_theme_id: string
	pain_theme_name: string
	user_group: DerivedGroup
	metrics: {
		frequency: number // 0-1: % of user group mentioning this pain
		intensity: "critical" | "high" | "medium" | "low" | null
		intensity_score: number // 0-1 for sorting
		willingness_to_pay: "high" | "medium" | "low" | "none" | null
		wtp_score: number // 0-1 for sorting
		impact_score: number // Combined: frequency * intensity * wtp
	}
	evidence: {
		count: number
		sample_verbatims: string[]
		person_ids: string[]
		person_count: number
	}
}

/**
 * Complete Pain × User Type matrix for Product Lens
 */
export type PainMatrix = {
	pain_themes: PainTheme[]
	user_groups: DerivedGroup[]
	cells: PainMatrixCell[]
	summary: {
		total_pains: number
		total_groups: number
		total_evidence: number
		high_impact_cells: number // Count of cells with impact_score > 0.7
	}
}

/**
 * Generate Pain × User Type matrix for Product Lens
 */
export async function generatePainMatrix(opts: {
	supabase: SupabaseClient
	projectId: string
	minEvidencePerPain?: number
	minGroupSize?: number
}): Promise<PainMatrix> {
	const { supabase, projectId, minEvidencePerPain = 3, minGroupSize = 2 } = opts

	consola.info(`[generatePainMatrix] Starting for project ${projectId}`)

	// 1. Get user groups
	const userGroups = await deriveUserGroups({
		supabase,
		projectId,
		minGroupSize,
	})
	consola.info(`[generatePainMatrix] Found ${userGroups.length} user groups`)

	// 2. Get all evidence with pains (support both old and new formats)
	// Old format: pains text[] column
	// New format: evidence_facet table with kind_slug='pain'

	// First, get evidence with old-style pains array
	const { data: evidenceOldFormat, error: evidenceError1 } = await supabase
		.from("evidence")
		.select("id, verbatim, confidence, pains")
		.eq("project_id", projectId)
		.not("pains", "is", null)

	// Then get evidence with new-style evidence_facet
	const { data: evidenceNewFormat, error: evidenceError2 } = await supabase
		.from("evidence")
		.select(
			`
      id,
      verbatim,
      confidence,
      evidence_facet!inner (
        kind_slug,
        label
      )
    `
		)
		.eq("project_id", projectId)
		.eq("evidence_facet.kind_slug", "pain")

	if (evidenceError1) throw evidenceError1
	if (evidenceError2) throw evidenceError2

	// Normalize both formats to a common structure
	const evidenceFromOldFormat = (evidenceOldFormat || [])
		.filter((ev) => ev.pains && ev.pains.length > 0)
		.flatMap((ev) =>
			ev.pains.map((painText: string) => ({
				id: ev.id,
				verbatim: ev.verbatim,
				confidence: ev.confidence,
				pain_label: painText,
				source_format: "old",
			}))
		)

	const evidenceFromNewFormat = (evidenceNewFormat || []).map((ev) => {
		const facets = Array.isArray(ev.evidence_facet) ? ev.evidence_facet : [ev.evidence_facet]
		const painFacet = facets.find((f) => f.kind_slug === "pain")
		return {
			id: ev.id,
			verbatim: ev.verbatim,
			confidence: ev.confidence,
			pain_label: painFacet?.label || "",
			source_format: "new",
		}
	})

	const evidenceWithPains = [...evidenceFromOldFormat, ...evidenceFromNewFormat]

	consola.info(
		`[generatePainMatrix] Found ${evidenceWithPains.length} evidence items with pains (${evidenceFromOldFormat.length} old format, ${evidenceFromNewFormat.length} new format)`
	)

	// 3. Get evidence -> people mappings from evidence_people junction table
	// Dedupe evidence IDs (old format can have multiple rows per evidence)
	const evidenceIds = [...new Set(evidenceWithPains?.map((e) => e.id) || [])]
	const evidenceToPeople = new Map<string, string[]>()

	if (evidenceIds.length > 0) {
		const { data: evidencePeople } = await supabase
			.from("evidence_people")
			.select("evidence_id, person_id")
			.in("evidence_id", evidenceIds)

		for (const ep of evidencePeople || []) {
			const existing = evidenceToPeople.get(ep.evidence_id) || []
			existing.push(ep.person_id)
			evidenceToPeople.set(ep.evidence_id, existing)
		}
	}

	// Attach person_ids to evidence
	const evidenceWithPeopleIds = (evidenceWithPains || []).map((ev) => ({
		...ev,
		person_ids: evidenceToPeople.get(ev.id) || [],
		// Map confidence to priority for now (until schema is updated)
		priority: ev.confidence || "medium",
		// Default WTP to medium (until schema is updated)
		willingness_to_pay: "medium",
	}))

	consola.info(
		`[generatePainMatrix] Mapped ${evidenceToPeople.size} evidence items to people, enriched ${evidenceWithPeopleIds.filter((e) => e.person_ids.length > 0).length} evidence items`
	)

	// 4. Cluster pains into themes using semantic embeddings
	// Tunable knobs:
	// - similarityThreshold: Lower = more aggressive clustering (0.65-0.85 range)
	// - minEvidencePerPain: Higher = fewer single-evidence themes
	const painThemes = await clusterPainsBySemantic({
		supabase,
		projectId,
		evidenceWithPains: evidenceWithPeopleIds,
		minEvidencePerPain,
		similarityThreshold: 0.70, // 70% similarity - good balance of precision/recall
	})
	consola.info(`[generatePainMatrix] Clustered into ${painThemes.length} pain themes using semantic embeddings`)

	// 5. Build matrix cells
	const cells: PainMatrixCell[] = []

	for (const pain of painThemes) {
		for (const group of userGroups) {
			const cell = await buildMatrixCell({
				supabase,
				projectId,
				painTheme: pain,
				userGroup: group,
				evidenceWithPains: evidenceWithPeopleIds,
			})

			// Only include cells with actual evidence
			if (cell.evidence.count > 0) {
				cells.push(cell)
			}
		}
	}

	// 6. Filter out pain themes that don't appear in any cells (orphaned evidence)
	const painThemesInCells = new Set(cells.map((c) => c.pain_theme_id))
	const filteredPainThemes = painThemes.filter((p) => painThemesInCells.has(p.id))

	// 7. Sort cells by impact score (descending)
	cells.sort((a, b) => b.metrics.impact_score - a.metrics.impact_score)

	// High impact threshold: >= 2.0 (at least 2+ people with meaningful intensity/WTP)
	const highImpactCells = cells.filter((c) => c.metrics.impact_score >= 2.0).length

	const orphanedPains = painThemes.length - filteredPainThemes.length
	if (orphanedPains > 0) {
		consola.warn(`[generatePainMatrix] Filtered out ${orphanedPains} pain themes with no user group mapping`)
	}

	consola.success(
		`[generatePainMatrix] Generated matrix: ${filteredPainThemes.length} pains × ${userGroups.length} groups = ${cells.length} cells (${highImpactCells} high-impact)`
	)

	return {
		pain_themes: filteredPainThemes,
		user_groups: userGroups,
		cells,
		summary: {
			total_pains: filteredPainThemes.length,
			total_groups: userGroups.length,
			total_evidence: evidenceWithPeopleIds.length,
			high_impact_cells: highImpactCells,
		},
	}
}

/**
 * Cluster pains into themes using semantic embeddings (Phase 3)
 * Groups similar pain labels together based on embedding similarity
 */
async function clusterPainsBySemantic(opts: {
	supabase: SupabaseClient
	projectId: string
	evidenceWithPains: any[]
	minEvidencePerPain: number
	similarityThreshold: number
}): Promise<PainTheme[]> {
	const { supabase, projectId, evidenceWithPains, minEvidencePerPain, similarityThreshold } = opts

	// Get unique pain labels with evidence IDs
	const painLabelMap = new Map<string, any[]>()
	for (const ev of evidenceWithPains) {
		const painLabel = ev.pain_label?.trim()
		if (!painLabel) continue

		const normalized = normalizePainLabel(painLabel)
		const group = painLabelMap.get(normalized) ?? []
		group.push(ev)
		painLabelMap.set(normalized, group)
	}

	// Filter out pains with insufficient evidence
	const validPainLabels = Array.from(painLabelMap.entries()).filter(
		([_, evidence]) => evidence.length >= minEvidencePerPain
	)

	if (validPainLabels.length === 0) {
		return []
	}

	// Query evidence_facet table to get embeddings for pain labels
	// This uses the new evidence_facet table with embeddings
	const { data: painFacets, error } = await supabase
		.from("evidence_facet")
		.select("id, label, embedding")
		.eq("project_id", projectId)
		.eq("kind_slug", "pain")
		.not("embedding", "is", null)

	if (error) {
		consola.error(`[clusterPainsBySemantic] Error fetching pain facets:`, error)
		// Fallback to label-based clustering
		return clusterPainsByLabel(evidenceWithPains, minEvidencePerPain)
	}

	// If no embeddings available yet, fall back to label clustering
	if (!painFacets || painFacets.length === 0) {
		consola.warn(`[clusterPainsBySemantic] No embeddings available, falling back to label clustering`)
		return clusterPainsByLabel(evidenceWithPains, minEvidencePerPain)
	}

	// Use the database function to find similar facet clusters
	const { data: clusters, error: clusterError } = await supabase.rpc("find_facet_clusters", {
		project_id_param: projectId,
		kind_slug_param: "pain",
		similarity_threshold: similarityThreshold,
	})

	if (clusterError) {
		consola.error(`[clusterPainsBySemantic] Error finding clusters:`, clusterError)
		return clusterPainsByLabel(evidenceWithPains, minEvidencePerPain)
	}

	// Build union-find structure to group similar pains
	const parent = new Map<string, string>()
	const find = (x: string): string => {
		if (!parent.has(x)) parent.set(x, x)
		if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
		return parent.get(x)!
	}
	const union = (x: string, y: string) => {
		const rootX = find(x)
		const rootY = find(y)
		if (rootX !== rootY) parent.set(rootX, rootY)
	}

	// Initialize all pain labels
	for (const [label] of validPainLabels) {
		parent.set(label, label)
	}

	// Group similar facets using clusters from database
	for (const cluster of clusters || []) {
		const label1 = normalizePainLabel(cluster.label_1)
		const label2 = normalizePainLabel(cluster.label_2)
		if (painLabelMap.has(label1) && painLabelMap.has(label2)) {
			union(label1, label2)
		}
	}

	// Group evidence by cluster root
	const clusterGroups = new Map<string, any[]>()
	for (const [label, evidence] of validPainLabels) {
		const root = find(label)
		const group = clusterGroups.get(root) ?? []
		group.push(...evidence)
		clusterGroups.set(root, group)
	}

	// Find representative label for each cluster (use most common one)
	const clusterLabels = new Map<string, string>()
	for (const [root] of clusterGroups) {
		const labelsInCluster: string[] = []
		for (const [label] of validPainLabels) {
			if (find(label) === root) {
				labelsInCluster.push(label)
			}
		}
		// Use the label with most evidence as the cluster name
		const representative = labelsInCluster.reduce((a, b) =>
			(painLabelMap.get(a)?.length || 0) > (painLabelMap.get(b)?.length || 0) ? a : b
		)
		clusterLabels.set(root, representative)
	}

	// Convert to PainTheme objects
	return Array.from(clusterGroups.entries())
		.map(([root, evidence]) => {
			const clusterName = clusterLabels.get(root) || root
			return {
				id: `pain-${root.toLowerCase().replace(/\s+/g, "-")}`,
				name: clusterName,
				description: `Semantic cluster: ${clusterName}`,
				evidence_ids: [...new Set(evidence.map((e) => e.id))],
				evidence_count: evidence.length,
			}
		})
		.sort((a, b) => b.evidence_count - a.evidence_count)
}

/**
 * Cluster evidence into pain themes by label (Phase 1: fallback for when embeddings unavailable)
 */
function clusterPainsByLabel(
	evidenceWithPains: any[],
	minEvidencePerPain: number
): PainTheme[] {
	const painGroups = new Map<string, any[]>()

	for (const ev of evidenceWithPains) {
		const painLabel = ev.pain_label?.trim()
		if (!painLabel) continue

		// Normalize pain label for clustering
		const normalized = normalizePainLabel(painLabel)

		const group = painGroups.get(normalized) ?? []
		group.push(ev)
		painGroups.set(normalized, group)
	}

	// Convert to PainTheme objects, filter by minimum evidence
	return Array.from(painGroups.entries())
		.filter(([_, evidence]) => evidence.length >= minEvidencePerPain)
		.map(([name, evidence]) => ({
			id: `pain-${name.toLowerCase().replace(/\s+/g, "-")}`,
			name,
			description: `Pain theme: ${name}`,
			evidence_ids: evidence.map((e) => e.id),
			evidence_count: evidence.length,
		}))
		.sort((a, b) => b.evidence_count - a.evidence_count) // Most evidence first
}

/**
 * Normalize pain labels for clustering
 * Phase 1: Simple normalization (lowercase, trim)
 * Phase 2: Use embeddings for semantic clustering
 */
function normalizePainLabel(label: string): string {
	// Keep full label for now - semantic clustering will handle grouping in Phase 2
	return label.trim().toLowerCase()
}

/**
 * Build a single matrix cell showing pain × user group metrics
 */
async function buildMatrixCell(opts: {
	supabase: SupabaseClient
	projectId: string
	painTheme: PainTheme
	userGroup: DerivedGroup
	evidenceWithPains: any[]
}): Promise<PainMatrixCell> {
	const { painTheme, userGroup, evidenceWithPains } = opts

	// Filter evidence for this pain that belongs to people in this group
	const relevantEvidence = evidenceWithPains.filter((ev) => {
		const inPainTheme = painTheme.evidence_ids.includes(ev.id)
		// Evidence can have multiple people (from interview participants)
		const hasUserInGroup = ev.person_ids?.some((personId: string) => userGroup.member_ids.includes(personId))
		return inPainTheme && hasUserInGroup
	})

	const evidenceCount = relevantEvidence.length
	// Flatten all person_ids and get unique ones
	const allPersonIds = relevantEvidence.flatMap((e) => e.person_ids || [])
	const uniquePersonIds = [...new Set(allPersonIds)].filter((id) => userGroup.member_ids.includes(id))
	const personCount = uniquePersonIds.length

	// Calculate frequency: what % of this user group mentions this pain?
	const frequency = userGroup.member_count > 0 ? personCount / userGroup.member_count : 0

	// Calculate average intensity
	const priorities = relevantEvidence.map((e) => e.priority).filter(Boolean)
	const intensityScore = calculateAverageIntensity(priorities)
	const intensity = scoreToIntensity(intensityScore)

	// Calculate willingness to pay distribution
	const wtpSignals = relevantEvidence.map((e) => e.willingness_to_pay).filter(Boolean)
	const wtpScore = calculateAverageWTP(wtpSignals)
	const willingness_to_pay = scoreToWTP(wtpScore)

	// Combined impact score: person_count × intensity × wtp (absolute business impact)
	const impact_score = personCount * intensityScore * wtpScore

	// Sample verbatims (up to 3)
	const sample_verbatims = relevantEvidence
		.filter((e) => e.verbatim)
		.slice(0, 3)
		.map((e) => e.verbatim)

	return {
		pain_theme_id: painTheme.id,
		pain_theme_name: painTheme.name,
		user_group: userGroup,
		metrics: {
			frequency,
			intensity,
			intensity_score: intensityScore,
			willingness_to_pay,
			wtp_score: wtpScore,
			impact_score,
		},
		evidence: {
			count: evidenceCount,
			sample_verbatims,
			person_ids: uniquePersonIds,
			person_count: personCount,
		},
	}
}

/**
 * Calculate average intensity score from priority strings
 */
function calculateAverageIntensity(priorities: string[]): number {
	if (priorities.length === 0) return 0

	const scores = priorities.map((p) => {
		switch (p.toLowerCase()) {
			case "critical":
				return 1.0
			case "high":
				return 0.75
			case "medium":
				return 0.5
			case "low":
				return 0.25
			default:
				return 0.5
		}
	})

	return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

/**
 * Calculate average WTP score from WTP strings
 */
function calculateAverageWTP(wtpSignals: string[]): number {
	if (wtpSignals.length === 0) return 0.5 // Neutral if unknown

	const scores = wtpSignals.map((w) => {
		switch (w.toLowerCase()) {
			case "high":
				return 1.0
			case "medium":
				return 0.66
			case "low":
				return 0.33
			case "none":
				return 0
			default:
				return 0.5
		}
	})

	return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

/**
 * Convert intensity score to label
 */
function scoreToIntensity(score: number): "critical" | "high" | "medium" | "low" | null {
	if (score >= 0.85) return "critical"
	if (score >= 0.65) return "high"
	if (score >= 0.4) return "medium"
	if (score > 0) return "low"
	return null
}

/**
 * Convert WTP score to label
 */
function scoreToWTP(score: number): "high" | "medium" | "low" | "none" | null {
	if (score >= 0.8) return "high"
	if (score >= 0.5) return "medium"
	if (score >= 0.2) return "low"
	if (score > 0) return "none"
	return null
}
