import consola from "consola"
import type { SupabaseClient, Theme, Theme_EvidenceInsert, ThemeInsert } from "~/types"
import { runBamlWithTracing } from "~/lib/baml/runBamlWithTracing.server"

// Input shape for evidence rows we pass to BAML. Mirrors columns in `public.evidence`.
interface EvidenceForTheme {
	id: string
	verbatim: string
	kind_tags: string[] | null
	personas: string[] | null
	segments: string[] | null
	journey_stage: string | null
	support: string | null
}

type AutoGroupThemesOptions = {
	supabase: SupabaseClient
	account_id: string
	project_id?: string | null
	evidence_ids?: string[] // if omitted, we will select recent evidence by project/account
	guidance?: string // optional naming conventions or business priorities
	limit?: number // max evidence rows to consider
}

type AutoGroupThemesResult = {
	created_theme_ids: string[]
	link_count: number
	themes: Theme[]
}

// Select evidence rows to analyze
async function loadEvidence(
	supabase: SupabaseClient,
	_account_id: string,
	project_id: string | null,
	evidence_ids?: string[],
	limit = 200
): Promise<EvidenceForTheme[]> {
	if (!project_id) {
		return
	}
	let query = supabase
		.from("evidence")
		.select("id, verbatim, kind_tags, personas, segments, journey_stage, support")
		.eq("project_id", project_id)

	// if (project_id) query = query.eq("project_id", project_id)
	if (evidence_ids && evidence_ids.length > 0) query = query.in("id", evidence_ids)
	else query = query.order("created_at", { ascending: false }).limit(limit)

	const { data, error } = await query
	if (error) throw error
	return (data || []) as unknown as EvidenceForTheme[]
}

// Upsert or fetch a theme by name within account/project scope
async function upsertTheme(
	supabase: SupabaseClient,
	payload: Omit<ThemeInsert, "id"> & { id?: string }
): Promise<Theme> {
	// Try find existing by (account_id, project_id, name)
	const { data: existing, error: findErr } = await supabase
		.from("themes")
		.select("*")
		.eq("account_id", payload.account_id)
		.eq("project_id", payload.project_id ?? null)
		.eq("name", payload.name)
		.maybeSingle()
	if (findErr && findErr.code !== "PGRST116") throw findErr

	if (existing) {
		// Update statement/criteria if provided
		const { data, error } = await supabase
			.from("themes")
			.update({
				statement: payload.statement ?? existing.statement,
				inclusion_criteria: payload.inclusion_criteria ?? existing.inclusion_criteria,
				exclusion_criteria: payload.exclusion_criteria ?? existing.exclusion_criteria,
				synonyms: payload.synonyms ?? existing.synonyms,
				anti_examples: payload.anti_examples ?? existing.anti_examples,
				project_id: payload.project_id ?? existing.project_id,
			})
			.eq("id", existing.id)
			.select("*")
			.single()
		if (error) throw error
		return data as Theme
	}

	const insertBody: ThemeInsert = {
		account_id: payload.account_id,
		project_id: payload.project_id ?? null,
		name: payload.name,
		statement: payload.statement ?? null,
		inclusion_criteria: payload.inclusion_criteria ?? null,
		exclusion_criteria: payload.exclusion_criteria ?? null,
		synonyms: payload.synonyms ?? [],
		anti_examples: payload.anti_examples ?? [],
	}

	const { data: created, error } = await supabase.from("themes").insert(insertBody).select("*").single()
	if (error) throw error
	return created as Theme
}

// Link evidence to a theme with rationale and confidence
async function upsertThemeEvidence(
	supabase: SupabaseClient,
	payload: Omit<Theme_EvidenceInsert, "id"> & { id?: string }
) {
	// unique(theme_id, evidence_id, account_id)
	const { data: existing, error: findErr } = await supabase
		.from("theme_evidence")
		.select("id")
		.eq("theme_id", payload.theme_id)
		.eq("evidence_id", payload.evidence_id)
		.eq("account_id", payload.account_id)
		.maybeSingle()
	if (findErr && findErr.code !== "PGRST116") throw findErr

	if (existing) {
		const { error } = await supabase
			.from("theme_evidence")
			.update({
				rationale: payload.rationale,
				confidence: payload.confidence ?? null,
				project_id: payload.project_id ?? null,
			})
			.eq("id", existing.id)
			.eq("account_id", payload.account_id)
		if (error) throw error
		return existing.id
	}

	const insertBody: Theme_EvidenceInsert = {
		account_id: payload.account_id,
		project_id: payload.project_id ?? null,
		theme_id: payload.theme_id,
		evidence_id: payload.evidence_id,
		rationale: payload.rationale ?? null,
		confidence: payload.confidence ?? null,
	}
	const { data, error } = await supabase.from("theme_evidence").insert(insertBody).select("id").single()
	if (error) throw error
	return data?.id as string
}

/**
 * Auto-generate themes from evidence and persist to DB with links.
 * Uses BAML `AutoGroupThemes` to propose themes and evidence link directives.
 */
export async function autoGroupThemesAndApply(opts: AutoGroupThemesOptions): Promise<AutoGroupThemesResult> {
	const { supabase, account_id, project_id = null, evidence_ids, guidance = "", limit = 200 } = opts

	consola.log("[autoGroupThemesAndApply] Starting with options:", { account_id, project_id, limit })

	// 1) Load evidence
	const evidence = await loadEvidence(supabase, account_id, project_id, evidence_ids, limit)
	consola.log("[autoGroupThemesAndApply] Loaded evidence count:", evidence.length)
	consola.log("[autoGroupThemesAndApply] First evidence sample:", evidence[0])

	if (evidence.length === 0) {
		consola.error("[autoGroupThemesAndApply] No evidence found for project:", project_id)
		throw new Error(`No evidence found for project ${project_id}. Cannot generate themes without evidence data.`)
	}

	// 2) Call BAML
	let resp
	try {
		const evidence_json = JSON.stringify(evidence)
		consola.log("[autoGroupThemesAndApply] Calling BAML with evidence length:", evidence_json.length)
		const { result } = await runBamlWithTracing({
			functionName: "AutoGroupThemes",
			traceName: "baml.auto-group-themes",
			input: {
				account_id,
				project_id,
				evidenceCount: evidence.length,
				guidanceLength: guidance.length,
			},
			metadata: { caller: "autoGroupThemesAndApply" },
			logUsageLabel: "AutoGroupThemes",
			bamlCall: (client) => client.AutoGroupThemes(evidence_json, guidance),
		})
		resp = result
		consola.log("[autoGroupThemesAndApply] BAML response received, themes count:", resp.themes?.length || 0)
	} catch (bamlError) {
		consola.error("[autoGroupThemesAndApply] BAML call failed:", bamlError)
		throw new Error(
			`BAML AutoGroupThemes failed: ${bamlError instanceof Error ? bamlError.message : String(bamlError)}`
		)
	}

	// 3) Persist themes and links
	const created_theme_ids: string[] = []
	const themes: Theme[] = []
	let link_count = 0

	const themesFromBaml = Array.isArray(resp?.themes) ? resp.themes : []
	if (!themesFromBaml.length) {
		consola.warn("[autoGroupThemesAndApply] BAML returned no themes")
		return { created_theme_ids, link_count, themes }
	}

	for (const t of themesFromBaml) {
		let theme: Theme
		try {
			theme = await upsertTheme(supabase, {
				account_id,
				project_id,
				name: t.name,
				statement: t.statement ?? null,
				inclusion_criteria: t.inclusion_criteria ?? null,
				exclusion_criteria: t.exclusion_criteria ?? null,
				synonyms: t.synonyms ?? [],
				anti_examples: t.anti_examples ?? [],
			})
		} catch (themeErr) {
			consola.warn("[autoGroupThemesAndApply] Failed to upsert theme", {
				name: t?.name,
				error: themeErr instanceof Error ? themeErr.message : themeErr,
			})
			continue
		}
		themes.push(theme)
		created_theme_ids.push(theme.id)

		const links = Array.isArray(t.links) ? t.links : []
		for (const link of links) {
			if (!link?.evidence_id) continue
			try {
				await upsertThemeEvidence(supabase, {
					account_id,
					project_id,
					theme_id: theme.id,
					evidence_id: link.evidence_id,
					rationale: link.rationale,
					confidence: link.confidence,
				})
				link_count += 1
			} catch (linkErr) {
				consola.warn("[autoGroupThemesAndApply] Failed to link evidence", {
					themeId: theme.id,
					evidenceId: link?.evidence_id,
					error: linkErr instanceof Error ? linkErr.message : linkErr,
				})
			}
		}
	}

	consola.success(`AutoGroupThemes applied: ${themes.length} themes, ${link_count} links`)
	return { created_theme_ids, link_count, themes }
}
