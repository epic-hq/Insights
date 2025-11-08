import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { getSegmentKindSummaries, getSegmentsSummary } from "~/features/segments/services/segmentData.server"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

const segmentKindSummarySchema = z.object({
	kind: z.string(),
	label: z.string(),
	person_count: z.number(),
})

const segmentSummarySchema = z.object({
	id: z.string(),
	kind: z.string(),
	label: z.string(),
	person_count: z.number(),
	evidence_count: z.number(),
	bullseye_score: z.number(),
	url: z.string().nullable(),
})

export const fetchSegmentsTool = createTool({
	id: "fetch-segments",
	description:
		"Fetch customer segments and segment kinds (personas, job functions, seniority levels, etc.) for a project. Returns bullseye scores indicating which segments are most likely to buy.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch segments for. Defaults to the current project in runtime context."),
		summaryOnly: z
			.boolean()
			.optional()
			.describe(
				"Set to true to only return segment kind summaries (e.g., how many personas, job functions, etc.). Defaults to false to return detailed segment data."
			),
		kind: z
			.string()
			.optional()
			.describe(
				"Filter segments by kind slug (persona, job_function, seniority_level, title, industry, life_stage, age_range)"
			),
		minBullseyeScore: z
			.number()
			.optional()
			.describe("Minimum bullseye score (0-100) to filter segments. Higher scores indicate better fit."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		accountId: z.string().nullable().optional(),
		kindSummaries: z.array(segmentKindSummarySchema).optional(),
		segments: z.array(segmentSummarySchema).optional(),
	}),
	execute: async (context, _options) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context.runtimeContext?.get?.("project_id")
		const runtimeAccountId = context.runtimeContext?.get?.("account_id")

		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const projectId = (context as any).projectId ?? runtimeProjectId ?? null
		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const summaryOnly = (context as any).summaryOnly ?? false
		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const kind = (context as any).kind
		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const minBullseyeScore = (context as any).minBullseyeScore

		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : null

		consola.info("[fetch-segments] execute start", {
			projectId,
			accountId,
			summaryOnly,
			kind,
			minBullseyeScore,
		})

		if (!projectId) {
			consola.warn("[fetch-segments] missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				accountId,
			}
		}

		try {
			// Generate route definitions for URL generation
			const projectPath = accountId && projectId ? `/a/${accountId}/${projectId}` : ""
			const routes = createRouteDefinitions(projectPath)

			if (summaryOnly) {
				// Get only segment kind summaries
				const kindSummaries = await getSegmentKindSummaries(supabase, projectId)

				return {
					success: true,
					message: `Retrieved ${kindSummaries.length} segment kind summaries.`,
					projectId,
					accountId,
					kindSummaries,
				}
			}

			// Get detailed segment data
			const segments = await getSegmentsSummary(supabase, projectId, {
				kind,
				minBullseyeScore,
			})

			// Add URLs to each segment
			const segmentsWithUrls = segments.map((segment) => ({
				...segment,
				url: projectPath ? `${HOST}${routes.segments.detail(segment.id)}` : null,
			}))

			let message = `Retrieved ${segmentsWithUrls.length} segments.`
			if (kind) {
				message += ` Filtered by kind: ${kind}.`
			}
			if (minBullseyeScore !== undefined) {
				message += ` Minimum bullseye score: ${minBullseyeScore}.`
			}

			return {
				success: true,
				message,
				projectId,
				accountId,
				segments: segmentsWithUrls,
			}
		} catch (error) {
			consola.error("[fetch-segments] unexpected error", error)
			return {
				success: false,
				message: "Unexpected error fetching segments.",
				projectId,
				accountId,
			}
		}
	},
})
