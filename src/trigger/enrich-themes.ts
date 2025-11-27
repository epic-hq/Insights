import { logger, schemaTask } from "@trigger.dev/sdk"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface ClusterFacet {
	id: string
	label: string
	kind_slug: string
}

interface ClusterAssessment {
	coherence_score: number
	quality: "high" | "medium" | "low"
	recommended_action: "approve" | "review" | "reject" | "split"
	reasoning: string
	theme: {
		name: string
		category: string
		pain: string | null
		jtbd: string | null
		desired_outcome: string | null
		emotional_response: string | null
		statement: string
		confidence: number
	}
	suggested_splits?: {
		name: string
		facet_ids: string[]
	}[]
}

// Batch enrich multiple themes
export const enrichThemesBatch = schemaTask({
	id: "enrich-themes-batch",
	schema: z.object({
		project_id: z.string().uuid(),
		account_id: z.string().uuid(),
		theme_ids: z.array(z.string().uuid()).optional(),
		max_themes: z.number().default(50),
	}),
	run: async (payload) => {
		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

		logger.info(`[enrich-themes-batch] Starting enrichment for project ${payload.project_id}`)

		// Get themes to enrich (either specified IDs or all themes with NULL metadata)
		let query = supabase
			.from("themes")
			.select("id, name, statement, project_id")
			.eq("project_id", payload.project_id)
			.order("created_at", { ascending: false })

		if (payload.theme_ids && payload.theme_ids.length > 0) {
			query = query.in("id", payload.theme_ids)
		} else {
			// Only enrich themes missing key metadata
			query = query.or("pain.is.null,jtbd.is.null,category.is.null").limit(payload.max_themes)
		}

		const { data: themes, error: themesError } = await query

		if (themesError) {
			logger.error(`[enrich-themes-batch] Failed to fetch themes: ${themesError.message}`)
			throw new Error(`Failed to fetch themes: ${themesError.message}`)
		}

		if (!themes || themes.length === 0) {
			logger.info(`[enrich-themes-batch] No themes found to enrich`)
			return { enriched: 0, skipped: 0, failed: 0 }
		}

		logger.info(`[enrich-themes-batch] Found ${themes.length} themes to enrich`)

		// Trigger individual enrichment tasks for each theme
		const batchResult = await enrichTheme.batchTriggerAndWait(
			themes.map((theme) => ({
				payload: {
					theme_id: theme.id,
					project_id: payload.project_id,
					account_id: payload.account_id,
				},
			}))
		)

		let enriched = 0
		let skipped = 0
		let failed = 0

		for (const run of batchResult.runs) {
			if (run.ok) {
				if (run.output.enriched) enriched++
				else skipped++
			} else {
				failed++
				logger.error(`[enrich-themes-batch] Task failed: ${run.error}`)
			}
		}

		logger.info(
			`[enrich-themes-batch] Complete: ${enriched} enriched, ${skipped} skipped, ${failed} failed`
		)

		return { enriched, skipped, failed }
	},
})

// Enrich a single theme
export const enrichTheme = schemaTask({
	id: "enrich-theme",
	schema: z.object({
		theme_id: z.string().uuid(),
		project_id: z.string().uuid(),
		account_id: z.string().uuid(),
	}),
	run: async (payload) => {
		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

		logger.info(`[enrich-theme] Processing theme ${payload.theme_id}`)

		// 1. Get theme details
		const { data: theme, error: themeError } = await supabase
			.from("themes")
			.select("id, name, statement, pain, jtbd, category")
			.eq("id", payload.theme_id)
			.single()

		if (themeError || !theme) {
			logger.error(`[enrich-theme] Failed to fetch theme: ${themeError?.message}`)
			return { enriched: false, reason: "Theme not found" }
		}

		// Skip if already has metadata
		if (theme.pain && theme.jtbd && theme.category) {
			logger.info(`[enrich-theme] Theme ${payload.theme_id} already has metadata, skipping`)
			return { enriched: false, reason: "Already enriched" }
		}

		// 2. Get evidence linked to this theme
		const { data: evidenceLinks, error: linksError } = await supabase
			.from("theme_evidence")
			.select("evidence_id, evidence:evidence_id(id, verbatim)")
			.eq("theme_id", payload.theme_id)
			.limit(20) // Sample first 20 evidence items

		if (linksError) {
			logger.error(`[enrich-theme] Failed to fetch evidence: ${linksError.message}`)
			return { enriched: false, reason: "Failed to fetch evidence" }
		}

		if (!evidenceLinks || evidenceLinks.length === 0) {
			logger.info(`[enrich-theme] No evidence found for theme ${payload.theme_id}`)
			return { enriched: false, reason: "No evidence" }
		}

		const evidenceIds = evidenceLinks.map((link: any) => link.evidence_id).filter(Boolean)
		const evidenceSamples = evidenceLinks
			.map((link: any) => link.evidence?.verbatim)
			.filter(Boolean)
			.slice(0, 10) as string[]

		// 3. Get evidence facets from the evidence
		const { data: facetLinks, error: facetsError } = await supabase
			.from("evidence_facet")
			.select("id, label, kind_slug, evidence_id")
			.in("evidence_id", evidenceIds)

		if (facetsError) {
			logger.error(`[enrich-theme] Failed to fetch facets: ${facetsError.message}`)
			return { enriched: false, reason: "Failed to fetch facets" }
		}

		if (!facetLinks || facetLinks.length === 0) {
			logger.info(`[enrich-theme] No facets found for theme ${payload.theme_id}`)
			return { enriched: false, reason: "No facets" }
		}

		// Deduplicate facets by ID
		const facetMap = new Map<string, ClusterFacet>()
		for (const facet of facetLinks as any[]) {
			if (!facetMap.has(facet.id)) {
				facetMap.set(facet.id, {
					id: facet.id,
					label: facet.label,
					kind_slug: facet.kind_slug,
				})
			}
		}

		const clusterFacets = Array.from(facetMap.values())

		logger.info(
			`[enrich-theme] Found ${clusterFacets.length} unique facets for theme ${payload.theme_id}`
		)

		// 4. Call assess-cluster Edge Function
		const assessResponse = await fetch(
			`${SUPABASE_URL}/functions/v1/assess-cluster`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
				},
				body: JSON.stringify({
					project_id: payload.project_id,
					account_id: payload.account_id,
					cluster_facets: clusterFacets,
					evidence_samples: evidenceSamples,
				}),
			}
		)

		if (!assessResponse.ok) {
			const errorText = await assessResponse.text()
			logger.error(`[enrich-theme] assess-cluster failed: ${errorText}`)
			return { enriched: false, reason: "Assessment failed" }
		}

		const assessResult = (await assessResponse.json()) as {
			success: boolean
			assessment: ClusterAssessment
		}

		if (!assessResult.success || !assessResult.assessment) {
			logger.error(`[enrich-theme] Assessment returned no data`)
			return { enriched: false, reason: "No assessment data" }
		}

		const assessment = assessResult.assessment

		logger.info(
			`[enrich-theme] Assessment: ${assessment.quality} quality, ${assessment.coherence_score} coherence, action: ${assessment.recommended_action}`
		)

		// 5. Update theme with enriched metadata (only update NULL fields)
		const updates: any = {}

		if (!theme.pain && assessment.theme.pain) {
			updates.pain = assessment.theme.pain
		}
		if (!theme.jtbd && assessment.theme.jtbd) {
			updates.jtbd = assessment.theme.jtbd
		}
		if (!theme.category && assessment.theme.category) {
			updates.category = assessment.theme.category
		}
		if (assessment.theme.desired_outcome) {
			updates.desired_outcome = assessment.theme.desired_outcome
		}
		if (assessment.theme.emotional_response) {
			updates.emotional_response = assessment.theme.emotional_response
		}
		if (assessment.theme.statement && assessment.theme.statement !== theme.statement) {
			updates.statement = assessment.theme.statement
		}

		if (Object.keys(updates).length === 0) {
			logger.info(`[enrich-theme] No updates needed for theme ${payload.theme_id}`)
			return { enriched: false, reason: "No updates needed" }
		}

		const { error: updateError } = await supabase
			.from("themes")
			.update(updates)
			.eq("id", payload.theme_id)

		if (updateError) {
			logger.error(`[enrich-theme] Failed to update theme: ${updateError.message}`)
			return { enriched: false, reason: "Update failed" }
		}

		logger.info(`[enrich-theme] Successfully enriched theme ${payload.theme_id}`)
		logger.info(`[enrich-theme] Updates: ${JSON.stringify(updates, null, 2)}`)

		return {
			enriched: true,
			assessment: {
				coherence_score: assessment.coherence_score,
				quality: assessment.quality,
				recommended_action: assessment.recommended_action,
			},
			updates: Object.keys(updates),
		}
	},
})
