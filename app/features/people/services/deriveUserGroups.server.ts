import type { SupabaseClient } from "~/types";

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
];

/**
 * Derived user group - emergent from people attributes, not pre-defined
 */
export type DerivedGroup = {
	type: "role" | "title" | "segment" | "industry" | "org_size" | "org_industry" | "company_type" | "cohort";
	name: string;
	description?: string;
	criteria: {
		role_in?: string[];
		title_in?: string[];
		segment_in?: string[];
		industry_in?: string[];
		org_size_in?: string[];
		org_industry_in?: string[];
		company_type_in?: string[];
		behaviors_all?: string[];
		behaviors_any?: string[];
	};
	member_count: number;
	member_ids: string[];
};

/**
 * Person with attributes for grouping (person attributes + linked organization attributes)
 */
type PersonWithAttributes = {
	id: string;
	name: string | null;
	// Person attributes
	role: string | null;
	title: string | null;
	segment: string | null;
	industry: string | null;
	occupation: string | null;
	// Organization attributes (joined from default_organization_id)
	company: string | null;
	org_size_range: string | null;
	org_employee_count: number | null;
	org_industry: string | null;
	org_company_type: string | null;
};

/**
 * Derive user groups from people attributes using rule-based clustering
 *
 * Phase 1: Simple grouping by role and segment
 * Phase 2: Add behavioral clustering with ML
 */
export async function deriveUserGroups(opts: {
	supabase: SupabaseClient;
	projectId: string;
	segmentId?: string; // DEPRECATED: Filter by specific segment (facet_account_id)
	segmentKindSlug?: string; // Filter by segment kind (e.g., "job_function", "life_stage")
	minGroupSize?: number;
	similarityThreshold?: number; // Threshold for semantic clustering (0.7 = 70% similarity)
}): Promise<DerivedGroup[]> {
	const { supabase, projectId, segmentKindSlug, minGroupSize = 2, similarityThreshold = 0.75 } = opts;

	// Get all people with their facets from person_facet table
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
		.eq("project_id", projectId);

	if (facetError) throw facetError;
	if (!personFacets || personFacets.length === 0) return [];

	// Filter facets to only include segment-type kinds
	const filteredFacets = personFacets.filter((pf: any) => {
		const kindSlug = pf.facet?.facet_kind_global?.slug;
		if (segmentKindSlug) {
			return kindSlug === segmentKindSlug;
		}
		return SEGMENT_FACET_KINDS.includes(kindSlug);
	});

	// Group by facet_account_id (not label) to prepare for semantic clustering
	const facetAccountGroups = new Map<number, { label: string; kindSlug: string; personIds: Set<string> }>();

	for (const pf of filteredFacets) {
		const facetAccountId = pf.facet_account_id;
		const facetLabel = (pf.facet as any)?.label;
		const kindSlug = (pf.facet as any)?.facet_kind_global?.slug;

		if (!facetAccountId || !facetLabel || !kindSlug) continue;

		if (!facetAccountGroups.has(facetAccountId)) {
			facetAccountGroups.set(facetAccountId, {
				label: facetLabel,
				kindSlug: kindSlug,
				personIds: new Set(),
			});
		}

		facetAccountGroups.get(facetAccountId)?.personIds.add(pf.person_id);
	}

	// Apply semantic clustering to group similar facets (e.g., "PM" + "Product Manager")
	const clusterMap = await clusterFacetsBySemantic({
		supabase,
		projectId,
		facetAccountGroups,
		minGroupSize,
		similarityThreshold,
	});

	// Convert clusters to DerivedGroup format
	const groups: DerivedGroup[] = [];
	const behavioralFacets = ["tool", "workflow", "preference", "value"];

	for (const [_rootFacetId, facetIdsInCluster] of clusterMap.entries()) {
		// Combine all people from facets in this cluster
		const allPersonIds = new Set<string>();
		const labels: string[] = [];
		let kindSlug = "";

		for (const facetId of facetIdsInCluster) {
			const group = facetAccountGroups.get(facetId);
			if (!group) continue;

			kindSlug = group.kindSlug;
			labels.push(group.label);

			for (const personId of group.personIds) {
				allPersonIds.add(personId);
			}
		}

		// Smart filtering: demographics use minGroupSize, behavioral require 2+ minimum
		const effectiveMinSize = behavioralFacets.includes(kindSlug) ? Math.max(minGroupSize, 2) : minGroupSize;

		if (allPersonIds.size < effectiveMinSize) continue;

		// Use the most common label as the cluster name (or combine if small cluster)
		const clusterName =
			labels.length === 1
				? labels[0]
				: labels.length <= 3
					? labels.join(" / ")
					: `${labels[0]} (+ ${labels.length - 1} similar)`;

		groups.push({
			type: kindSlug as any,
			name: clusterName,
			description:
				labels.length > 1 ? `Semantic cluster: ${labels.join(", ")}` : `People with ${kindSlug}: ${clusterName}`,
			criteria: {},
			member_count: allPersonIds.size,
			member_ids: Array.from(allPersonIds),
		});
	}

	// Sort by largest groups first and return
	return groups.sort((a, b) => b.member_count - a.member_count);
}

/**
 * Get evidence count by user group
 */
export async function getEvidenceByGroup(opts: {
	supabase: SupabaseClient;
	projectId: string;
	group: DerivedGroup;
}): Promise<number> {
	const { supabase, projectId, group } = opts;

	// Count evidence where person_id is in group members
	const { count, error } = await supabase
		.from("evidence")
		.select("*", { count: "exact", head: true })
		.eq("project_id", projectId)
		.in("person_id", group.member_ids);

	if (error) throw error;
	return count ?? 0;
}

/**
 * Future: Behavioral clustering using evidence patterns
 * This will use embeddings and ML clustering (Phase 2)
 */
export async function derivePersonasFromBehaviors(_opts: {
	supabase: SupabaseClient;
	projectId: string;
	minClusterSize?: number;
}): Promise<DerivedGroup[]> {
	// TODO: Phase 2 - cluster people by:
	// - Pain patterns (which pains they mention)
	// - Workflow patterns (tools they use, processes they follow)
	// - Goal patterns (what they're trying to achieve)
	// Using embeddings + k-means or hierarchical clustering
	return [];
}

/**
 * Cluster person facets by semantic similarity
 * Groups similar labels like "Product Manager", "PM", "Product Lead" into one segment
 */
async function clusterFacetsBySemantic(opts: {
	supabase: SupabaseClient;
	projectId: string;
	facetAccountGroups: Map<number, { label: string; kindSlug: string; personIds: Set<string> }>;
	minGroupSize: number;
	similarityThreshold: number;
}): Promise<Map<number, Set<number>>> {
	const { supabase, projectId, facetAccountGroups, similarityThreshold } = opts;

	if (facetAccountGroups.size === 0) {
		return new Map();
	}

	// Get the kind slug (assuming all facets in this call are the same kind)
	const firstGroup = Array.from(facetAccountGroups.values())[0];
	const kindSlug = firstGroup.kindSlug;

	// Use database function to find similar facet clusters
	const { data: clusters, error: clusterError } = await supabase.rpc("find_person_facet_clusters", {
		project_id_param: projectId,
		kind_slug_param: kindSlug,
		similarity_threshold: similarityThreshold,
	});

	if (clusterError) {
		console.error("[clusterFacetsBySemantic] Error finding clusters:", clusterError);
		// Return identity mapping (no clustering)
		return new Map(Array.from(facetAccountGroups.keys()).map((id) => [id, new Set([id])]));
	}

	if (!clusters || clusters.length === 0) {
		// No similar facets found, return identity mapping
		return new Map(Array.from(facetAccountGroups.keys()).map((id) => [id, new Set([id])]));
	}

	// Build union-find structure to group similar facets
	const parent = new Map<number, number>();
	const find = (x: number): number => {
		if (!parent.has(x)) parent.set(x, x);
		if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!));
		return parent.get(x)!;
	};
	const union = (x: number, y: number) => {
		const rootX = find(x);
		const rootY = find(y);
		if (rootX !== rootY) parent.set(rootX, rootY);
	};

	// Initialize all facet_account_ids
	for (const facetAccountId of facetAccountGroups.keys()) {
		parent.set(facetAccountId, facetAccountId);
	}

	// Group similar facets using clusters from database
	for (const cluster of clusters) {
		const id1 = cluster.facet_account_id_1;
		const id2 = cluster.facet_account_id_2;
		if (facetAccountGroups.has(id1) && facetAccountGroups.has(id2)) {
			union(id1, id2);
		}
	}

	// Build map of root -> set of facet_account_ids in that cluster
	const clusterMap = new Map<number, Set<number>>();
	for (const facetAccountId of facetAccountGroups.keys()) {
		const root = find(facetAccountId);
		if (!clusterMap.has(root)) {
			clusterMap.set(root, new Set());
		}
		clusterMap.get(root)?.add(facetAccountId);
	}

	return clusterMap;
}
