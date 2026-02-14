/**
 * Bidirectional queries for Themes × User Segments
 *
 * Enables two key discovery patterns:
 * 1. Segment → Themes: "What are the top concerns for this set of users?"
 * 2. Themes → Segment: "Who are the users experiencing these specific pains/themes?"
 *
 * Uses evidence_facet.person_id for direct person attribution (optimized query path).
 */

import consola from "consola";
import type { SupabaseClient } from "~/types";

/**
 * Theme with frequency data for a specific segment
 */
export type ThemeWithFrequency = {
	theme_id: string;
	theme_name: string;
	statement: string | null;
	evidence_count: number;
	person_count: number;
	frequency: number; // % of segment mentioning this theme
	sample_quotes: string[];
};

/**
 * Person with their theme associations
 */
export type PersonWithThemes = {
	person_id: string;
	person_name: string | null;
	email: string | null;
	theme_ids: string[];
	theme_names: string[];
	facet_count: number; // How many facets link this person to themes
};

/**
 * Direction 1: Get top concerns/themes for a specific user segment
 *
 * @param segmentPersonIds - Array of person IDs in the target segment
 * @param projectId - Project scope
 * @param options - Query options (limit, facet kinds to include)
 * @returns Themes ranked by frequency within the segment
 */
export async function getTopConcernsForSegment(opts: {
	supabase: SupabaseClient;
	projectId: string;
	segmentPersonIds: string[];
	facetKinds?: string[]; // e.g., ["pain", "goal", "need"] - defaults to ["pain"]
	limit?: number;
}): Promise<ThemeWithFrequency[]> {
	const { supabase, projectId, segmentPersonIds, facetKinds = ["pain"], limit = 20 } = opts;

	if (segmentPersonIds.length === 0) {
		consola.warn("[getTopConcernsForSegment] Empty segment, returning []");
		return [];
	}

	consola.info(`[getTopConcernsForSegment] Finding top concerns for ${segmentPersonIds.length} people in segment`);

	// Query evidence_facet with person_id filter to get facets for this segment
	const { data: facets, error: facetError } = await supabase
		.from("evidence_facet")
		.select(
			`
      id,
      evidence_id,
      person_id,
      kind_slug,
      label,
      quote,
      evidence!inner (
        id,
        verbatim
      )
    `
		)
		.eq("project_id", projectId)
		.in("person_id", segmentPersonIds)
		.in("kind_slug", facetKinds);

	if (facetError) {
		consola.error("[getTopConcernsForSegment] Error fetching facets:", facetError);
		throw facetError;
	}

	if (!facets || facets.length === 0) {
		consola.info("[getTopConcernsForSegment] No facets found for segment");
		return [];
	}

	// Get theme_evidence links for these evidence IDs
	const evidenceIds = [...new Set(facets.map((f) => f.evidence_id))];

	const { data: themeLinks, error: linkError } = await supabase
		.from("theme_evidence")
		.select(
			`
      theme_id,
      evidence_id,
      themes!inner (
        id,
        name,
        statement
      )
    `
		)
		.eq("project_id", projectId)
		.in("evidence_id", evidenceIds);

	if (linkError) {
		consola.error("[getTopConcernsForSegment] Error fetching theme links:", linkError);
		throw linkError;
	}

	// Build theme → evidence → person mapping
	const themeStats = new Map<
		string,
		{
			theme: { id: string; name: string; statement: string | null };
			evidenceIds: Set<string>;
			personIds: Set<string>;
			quotes: string[];
		}
	>();

	// Create evidence → person mapping from facets
	const evidenceToPersons = new Map<string, Set<string>>();
	const evidenceToQuotes = new Map<string, string[]>();

	for (const facet of facets) {
		if (!evidenceToPersons.has(facet.evidence_id)) {
			evidenceToPersons.set(facet.evidence_id, new Set());
			evidenceToQuotes.set(facet.evidence_id, []);
		}
		if (facet.person_id) {
			evidenceToPersons.get(facet.evidence_id)!.add(facet.person_id);
		}
		const quote = facet.quote || (facet.evidence as any)?.verbatim;
		if (quote) {
			evidenceToQuotes.get(facet.evidence_id)!.push(quote);
		}
	}

	// Aggregate by theme
	for (const link of themeLinks || []) {
		const theme = link.themes as any;
		if (!theme) continue;

		if (!themeStats.has(theme.id)) {
			themeStats.set(theme.id, {
				theme: { id: theme.id, name: theme.name, statement: theme.statement },
				evidenceIds: new Set(),
				personIds: new Set(),
				quotes: [],
			});
		}

		const stats = themeStats.get(theme.id)!;
		stats.evidenceIds.add(link.evidence_id);

		// Add persons from this evidence
		const persons = evidenceToPersons.get(link.evidence_id);
		if (persons) {
			for (const p of persons) stats.personIds.add(p);
		}

		// Add quotes from this evidence
		const quotes = evidenceToQuotes.get(link.evidence_id);
		if (quotes) {
			stats.quotes.push(...quotes);
		}
	}

	// Convert to output format and calculate frequency
	const segmentSize = segmentPersonIds.length;
	const results: ThemeWithFrequency[] = Array.from(themeStats.values())
		.map((stats) => ({
			theme_id: stats.theme.id,
			theme_name: stats.theme.name,
			statement: stats.theme.statement,
			evidence_count: stats.evidenceIds.size,
			person_count: stats.personIds.size,
			frequency: stats.personIds.size / segmentSize,
			sample_quotes: [...new Set(stats.quotes)].slice(0, 3),
		}))
		.sort((a, b) => b.frequency - a.frequency)
		.slice(0, limit);

	consola.success(
		`[getTopConcernsForSegment] Found ${results.length} themes for segment (top: "${results[0]?.theme_name}" at ${Math.round((results[0]?.frequency || 0) * 100)}%)`
	);

	return results;
}

/**
 * Direction 2: Get users who experience specific themes/pains
 *
 * @param themeIds - Array of theme IDs to filter by
 * @param projectId - Project scope
 * @param options - Query options (require all themes vs any, limit)
 * @returns People who have evidence linked to the specified themes
 */
export async function getUsersWithThemes(opts: {
	supabase: SupabaseClient;
	projectId: string;
	themeIds: string[];
	requireAll?: boolean; // If true, person must have ALL themes; if false, ANY theme
	limit?: number;
}): Promise<PersonWithThemes[]> {
	const { supabase, projectId, themeIds, requireAll = false, limit = 50 } = opts;

	if (themeIds.length === 0) {
		consola.warn("[getUsersWithThemes] No themes specified, returning []");
		return [];
	}

	consola.info(`[getUsersWithThemes] Finding users with ${themeIds.length} themes (requireAll: ${requireAll})`);

	// Get theme_evidence links for specified themes
	const { data: themeLinks, error: linkError } = await supabase
		.from("theme_evidence")
		.select(
			`
      theme_id,
      evidence_id,
      themes!inner (
        id,
        name
      )
    `
		)
		.eq("project_id", projectId)
		.in("theme_id", themeIds);

	if (linkError) {
		consola.error("[getUsersWithThemes] Error fetching theme links:", linkError);
		throw linkError;
	}

	if (!themeLinks || themeLinks.length === 0) {
		consola.info("[getUsersWithThemes] No evidence linked to specified themes");
		return [];
	}

	// Get evidence IDs
	const evidenceIds = [...new Set(themeLinks.map((l) => l.evidence_id))];

	// Get evidence_facet with person_id for these evidence records
	const { data: facets, error: facetError } = await supabase
		.from("evidence_facet")
		.select("evidence_id, person_id")
		.eq("project_id", projectId)
		.in("evidence_id", evidenceIds)
		.not("person_id", "is", null);

	if (facetError) {
		consola.error("[getUsersWithThemes] Error fetching facets:", facetError);
		throw facetError;
	}

	// Build evidence → theme mapping
	const evidenceToThemes = new Map<string, Set<string>>();
	const evidenceToThemeNames = new Map<string, Set<string>>();

	for (const link of themeLinks) {
		if (!evidenceToThemes.has(link.evidence_id)) {
			evidenceToThemes.set(link.evidence_id, new Set());
			evidenceToThemeNames.set(link.evidence_id, new Set());
		}
		evidenceToThemes.get(link.evidence_id)!.add(link.theme_id);
		evidenceToThemeNames.get(link.evidence_id)!.add((link.themes as any).name);
	}

	// Aggregate by person
	const personStats = new Map<
		string,
		{
			themeIds: Set<string>;
			themeNames: Set<string>;
			facetCount: number;
		}
	>();

	for (const facet of facets || []) {
		if (!facet.person_id) continue;

		if (!personStats.has(facet.person_id)) {
			personStats.set(facet.person_id, {
				themeIds: new Set(),
				themeNames: new Set(),
				facetCount: 0,
			});
		}

		const stats = personStats.get(facet.person_id)!;
		stats.facetCount++;

		const themes = evidenceToThemes.get(facet.evidence_id);
		const names = evidenceToThemeNames.get(facet.evidence_id);
		if (themes) {
			for (const t of themes) stats.themeIds.add(t);
		}
		if (names) {
			for (const n of names) stats.themeNames.add(n);
		}
	}

	// Filter by requireAll if needed
	let filteredPersons = Array.from(personStats.entries());
	if (requireAll) {
		const themeIdSet = new Set(themeIds);
		filteredPersons = filteredPersons.filter(([_, stats]) => {
			for (const t of themeIdSet) {
				if (!stats.themeIds.has(t)) return false;
			}
			return true;
		});
	}

	// Get person details
	const personIds = filteredPersons.map(([id]) => id);
	if (personIds.length === 0) {
		consola.info("[getUsersWithThemes] No people matched the theme criteria");
		return [];
	}

	const { data: people, error: peopleError } = await supabase
		.from("people")
		.select("id, name, primary_email")
		.in("id", personIds.slice(0, limit));

	if (peopleError) {
		consola.error("[getUsersWithThemes] Error fetching people:", peopleError);
		throw peopleError;
	}

	// Build result
	const results: PersonWithThemes[] = (people || []).map((person) => {
		const stats = personStats.get(person.id)!;
		return {
			person_id: person.id,
			person_name: person.name,
			email: person.primary_email,
			theme_ids: Array.from(stats.themeIds),
			theme_names: Array.from(stats.themeNames),
			facet_count: stats.facetCount,
		};
	});

	// Sort by facet count (most engaged first)
	results.sort((a, b) => b.facet_count - a.facet_count);

	consola.success(`[getUsersWithThemes] Found ${results.length} people matching theme criteria`);

	return results.slice(0, limit);
}

/**
 * Get themes with no evidence links (candidates for cleanup)
 */
export async function getOrphanedThemes(opts: {
	supabase: SupabaseClient;
	projectId: string;
}): Promise<Array<{ id: string; name: string; created_at: string }>> {
	const { supabase, projectId } = opts;

	// Query themes that have 0 evidence links
	const { data: themes, error } = await supabase
		.from("themes")
		.select(
			`
      id,
      name,
      created_at,
      theme_evidence (id)
    `
		)
		.eq("project_id", projectId);

	if (error) {
		consola.error("[getOrphanedThemes] Error:", error);
		throw error;
	}

	const orphaned = (themes || [])
		.filter((t) => {
			const links = t.theme_evidence as any[];
			return !links || links.length === 0;
		})
		.map((t) => ({
			id: t.id,
			name: t.name,
			created_at: t.created_at,
		}));

	consola.info(`[getOrphanedThemes] Found ${orphaned.length} themes with 0 evidence`);

	return orphaned;
}

/**
 * Delete themes with no evidence links
 * Called after theme creation to clean up orphaned themes
 */
export async function deleteOrphanedThemes(opts: {
	supabase: SupabaseClient;
	projectId: string;
	themeIds?: string[]; // Optional: only check specific themes
}): Promise<{ deleted_count: number; deleted_ids: string[] }> {
	const { supabase, projectId, themeIds } = opts;

	// Find orphaned themes
	let query = supabase
		.from("themes")
		.select(
			`
      id,
      name,
      theme_evidence (id)
    `
		)
		.eq("project_id", projectId);

	if (themeIds && themeIds.length > 0) {
		query = query.in("id", themeIds);
	}

	const { data: themes, error: fetchError } = await query;

	if (fetchError) {
		consola.error("[deleteOrphanedThemes] Error fetching themes:", fetchError);
		throw fetchError;
	}

	const orphanedIds = (themes || [])
		.filter((t) => {
			const links = t.theme_evidence as any[];
			return !links || links.length === 0;
		})
		.map((t) => t.id);

	if (orphanedIds.length === 0) {
		consola.info("[deleteOrphanedThemes] No orphaned themes to delete");
		return { deleted_count: 0, deleted_ids: [] };
	}

	// Delete orphaned themes
	const { error: deleteError } = await supabase.from("themes").delete().in("id", orphanedIds);

	if (deleteError) {
		consola.error("[deleteOrphanedThemes] Error deleting themes:", deleteError);
		throw deleteError;
	}

	consola.success(`[deleteOrphanedThemes] Deleted ${orphanedIds.length} themes with 0 evidence`);

	return { deleted_count: orphanedIds.length, deleted_ids: orphanedIds };
}
