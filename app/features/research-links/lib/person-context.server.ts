/**
 * Person and project context fetching for personalized survey generation.
 * Used by generate-campaign-questions API to build BAML input.
 */

import type { SupabaseClient } from "~/types";

// ============================================================================
// Types matching BAML PersonContext / ProjectContext
// ============================================================================

export interface PersonFacets {
	pains: string[];
	goals: string[];
	workflows: string[];
	tools: string[];
}

export interface PersonContext {
	name: string;
	title: string | null;
	company: string | null;
	role: string | null;
	seniority_level: string | null;
	icp_band: string | null;
	icp_score: number | null;
	facets: PersonFacets;
	missing_fields: string[];
	conversation_themes: string[];
	last_interaction_date: string | null;
	sparse_mode: boolean;
}

export interface ThemeValidation {
	theme_name: string;
	evidence_count: number;
	target_count: number;
	confidence: string;
}

export interface ProjectContext {
	research_goals: string[];
	themes_needing_validation: ThemeValidation[];
	decision_questions: string[];
}

// ============================================================================
// Seniority extraction from title
// ============================================================================

const SENIORITY_PATTERNS: Array<{ pattern: RegExp; level: string }> = [
	{ pattern: /\b(ceo|cto|cfo|coo|cmo|cpo|cro)\b/i, level: "C-Level" },
	{ pattern: /\bchief\b/i, level: "C-Level" },
	{ pattern: /\b(svp|senior vice president)\b/i, level: "SVP" },
	{ pattern: /\b(vp|vice president)\b/i, level: "VP" },
	{ pattern: /\bdirector\b/i, level: "Director" },
	{ pattern: /\b(senior|sr\.?|staff|principal|lead)\b/i, level: "Senior" },
	{ pattern: /\b(manager|head of)\b/i, level: "Manager" },
	{ pattern: /\bjunior|jr\.?\b/i, level: "Junior" },
];

function extractSeniority(title: string | null): string | null {
	if (!title) return null;
	for (const { pattern, level } of SENIORITY_PATTERNS) {
		if (pattern.test(title)) return level;
	}
	return "IC";
}

const ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
	{
		pattern: /\b(engineer(?:ing)?|developer|software|sre|devops|platform)\b/i,
		role: "Engineering",
	},
	{ pattern: /\b(product|pm)\b/i, role: "Product" },
	{ pattern: /\b(design(?:er)?|ux|ui)\b/i, role: "Design" },
	{
		pattern: /\b(market(?:ing)?|growth|demand gen|content)\b/i,
		role: "Marketing",
	},
	{
		pattern: /\b(sales|account exec(?:utive)?|ae|sdr|bdr)\b/i,
		role: "Sales",
	},
	{ pattern: /\b(success|support|cx)\b/i, role: "Customer Success" },
	{ pattern: /\b(research|insight|analyst)\b/i, role: "Research" },
	{ pattern: /\b(ops|operations)\b/i, role: "Operations" },
	{ pattern: /\b(data|analytics|ml|ai)\b/i, role: "Data" },
];

function extractRole(title: string | null): string | null {
	if (!title) return null;
	for (const { pattern, role } of ROLE_PATTERNS) {
		if (pattern.test(title)) return role;
	}
	return null;
}

// ============================================================================
// Fetch person context
// ============================================================================

export async function fetchPersonContext(
	supabase: SupabaseClient,
	personId: string,
	projectId: string
): Promise<PersonContext> {
	// Run all queries in parallel
	const [personResult, personOrgResult, icpResult, facetsResult, themesResult, lastEvidenceResult] = await Promise.all([
		supabase.from("people").select("id, firstname, lastname, title, primary_email").eq("id", personId).single(),

		supabase
			.from("person_organization")
			.select("organization:organizations(name)")
			.eq("person_id", personId)
			.maybeSingle(),

		supabase.from("person_scale").select("score").eq("person_id", personId).eq("kind_slug", "icp_match").maybeSingle(),

		supabase.from("person_facet").select("kind_slug, value").eq("person_id", personId),

		supabase.rpc("get_person_top_themes", {
			p_person_id: personId,
			p_limit: 5,
		}),

		// Get most recent evidence date for this person
		supabase
			.from("evidence_people")
			.select("evidence:evidence(created_at)")
			.eq("person_id", personId)
			.order("evidence(created_at)" as string, { ascending: false })
			.limit(1)
			.maybeSingle(),
	]);

	const person = personResult.data;
	if (!person) {
		throw new Error(`Person ${personId} not found`);
	}

	// Organize facets by kind
	const facetsByKind: Record<string, string[]> = {};
	for (const facet of facetsResult.data || []) {
		if (!facetsByKind[facet.kind_slug]) {
			facetsByKind[facet.kind_slug] = [];
		}
		facetsByKind[facet.kind_slug].push(facet.value);
	}

	// ICP band
	const score = icpResult.data?.score ?? 0;
	let icpBand = "Weak";
	if (score >= 0.7) icpBand = "Strong";
	else if (score >= 0.5) icpBand = "Moderate";

	// Organization name
	const orgData = personOrgResult.data as {
		organization: { name: string } | null;
	} | null;
	const companyName = orgData?.organization?.name ?? null;

	// Missing fields
	const missingFields: string[] = [];
	if (!person.title) missingFields.push("title");
	if (!companyName) missingFields.push("company");
	if (!facetsByKind.pain?.length) missingFields.push("pains");
	if (!facetsByKind.goal?.length) missingFields.push("goals");
	if (!facetsByKind.workflow?.length) missingFields.push("workflows");

	// Last interaction date
	const lastEvidence = lastEvidenceResult.data as {
		evidence: { created_at: string } | null;
	} | null;
	const lastInteractionDate = lastEvidence?.evidence?.created_at
		? new Date(lastEvidence.evidence.created_at).toISOString().split("T")[0]
		: null;

	return {
		name: `${person.firstname || ""} ${person.lastname || ""}`.trim() || "Unknown",
		title: person.title ?? null,
		company: companyName,
		role: extractRole(person.title ?? null),
		seniority_level: extractSeniority(person.title ?? null),
		icp_band: icpBand,
		icp_score: score,
		facets: {
			pains: facetsByKind.pain || [],
			goals: facetsByKind.goal || [],
			workflows: facetsByKind.workflow || [],
			tools: facetsByKind.tool || [],
		},
		missing_fields: missingFields,
		conversation_themes: (themesResult.data || []).map((t: { theme_name: string }) => t.theme_name),
		last_interaction_date: lastInteractionDate,
		sparse_mode: missingFields.length >= 3,
	};
}

// ============================================================================
// Fetch project context
// ============================================================================

const EVIDENCE_CONFIDENCE_TARGET = 5;

export async function fetchProjectContext(supabase: SupabaseClient, projectId: string): Promise<ProjectContext> {
	const [projectResult, themesResult] = await Promise.all([
		supabase.from("projects").select("name, description").eq("id", projectId).single(),

		// Get themes with evidence counts
		supabase
			.from("themes")
			.select("id, name")
			.eq("project_id", projectId)
			.limit(20),
	]);

	const project = projectResult.data;
	const themes = themesResult.data || [];

	// For each theme, get evidence count (run in parallel)
	const themeCounts = await Promise.all(
		themes.map(async (theme) => {
			const { count } = await supabase
				.from("theme_evidence")
				.select("*", { count: "exact", head: true })
				.eq("theme_id", theme.id);
			return { ...theme, evidence_count: count ?? 0 };
		})
	);

	// Themes needing validation: fewer than target evidence pieces
	const themesNeedingValidation: ThemeValidation[] = themeCounts
		.filter((t) => t.evidence_count < EVIDENCE_CONFIDENCE_TARGET)
		.map((t) => ({
			theme_name: t.name,
			evidence_count: t.evidence_count,
			target_count: EVIDENCE_CONFIDENCE_TARGET,
			confidence: t.evidence_count === 0 ? "low" : t.evidence_count < 3 ? "low" : "medium",
		}))
		.slice(0, 5);

	return {
		research_goals: project?.description ? [project.description] : ["General customer research"],
		themes_needing_validation: themesNeedingValidation,
		decision_questions: [],
	};
}
