import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const matrixDataSchema = z.object({}).passthrough()

const freshnessSchema = z.object({
	isFresh: z.boolean(),
	evidenceCountDelta: z.number(),
	deltaPercent: z.number(),
	currentEvidenceCount: z.number(),
	threshold: z.number(),
	evaluatedAt: z.string(),
})

export const fetchPainMatrixCacheTool = createTool({
	id: "fetch-pain-matrix-cache",
	description:
		"Retrieve the cached Product Lens pain matrix for a project, including freshness metadata to understand whether a recompute is needed.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch the cached matrix for. Defaults to the current project in runtime context."),
		computeFreshness: z
			.boolean()
			.optional()
			.describe(
				"Set to false to skip recounting evidence for freshness checks (useful when minimizing additional Supabase queries). Defaults to true."
			),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		accountId: z.string().nullable().optional(),
		cache: z
			.object({
				id: z.string(),
				projectId: z.string(),
				accountId: z.string(),
				matrix: matrixDataSchema,
				insights: z.string().nullable(),
				evidenceCount: z.number(),
				painCount: z.number(),
				userGroupCount: z.number(),
				computationTimeMs: z.number().nullable(),
				createdAt: z.string(),
				lastUpdated: z.string(),
				freshness: freshnessSchema.nullable(),
			})
			.nullable(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const requestedProjectId = (context as any).projectId ?? runtimeProjectId ?? null
		// biome-ignore lint/suspicious/noExplicitAny: Mastra tool context typing
		const computeFreshness =
			typeof (context as any).computeFreshness === "boolean" ? (context as any).computeFreshness : true

		const accountId = runtimeAccountId ? String(runtimeAccountId).trim() : null
		const projectId = requestedProjectId ? String(requestedProjectId).trim() : null

		consola.info("[fetch-pain-matrix-cache] execute start", {
			projectId,
			accountId,
			computeFreshness,
		})

		if (!projectId) {
			consola.warn("[fetch-pain-matrix-cache] missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				accountId,
				cache: null,
			}
		}

		try {
			const { data: rows, error } = await supabase
				.from("pain_matrix_cache")
				.select("*")
				.eq("project_id", projectId)
				.order("updated_at", { ascending: false })
				.limit(1)

			if (error) {
				consola.error("[fetch-pain-matrix-cache] error fetching cache", error)
				return {
					success: false,
					message: "Failed to fetch pain matrix cache.",
					projectId,
					accountId,
					cache: null,
				}
			}

			const cached = rows?.[0] ?? null

			if (!cached) {
				consola.info("[fetch-pain-matrix-cache] no cache found", { projectId })
				return {
					success: true,
					message: "No cached pain matrix found for this project.",
					projectId,
					accountId,
					cache: null,
				}
			}

			if (accountId && cached.account_id !== accountId) {
				consola.warn("[fetch-pain-matrix-cache] cache belongs to different account", {
					projectId,
					accountId,
					cacheAccount: cached.account_id,
				})
				return {
					success: false,
					message: "Cached matrix belongs to a different account. Verify project and account context.",
					projectId,
					accountId,
					cache: null,
				}
			}

			let freshness: z.infer<typeof freshnessSchema> | null = null

			if (computeFreshness) {
				const { count: currentEvidenceCount, error: evidenceError } = await supabase
					.from("evidence")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId)
					.or("pains.not.is.null,evidence_facet.kind_slug.eq.pain")

				if (evidenceError) {
					consola.error("[fetch-pain-matrix-cache] evidence count error", evidenceError)
				} else {
					const baseline = cached.evidence_count || 0
					const count = currentEvidenceCount ?? 0
					const evidenceDelta = count - baseline
					const deltaPercent = baseline > 0 ? Math.abs(evidenceDelta) / baseline : count > 0 ? 1 : 0
					const threshold = 0.1

					freshness = {
						isFresh: deltaPercent < threshold,
						evidenceCountDelta: evidenceDelta,
						deltaPercent,
						currentEvidenceCount: count,
						threshold,
						evaluatedAt: new Date().toISOString(),
					}
				}
			}

			const matrixData =
				cached.matrix_data && typeof cached.matrix_data === "object" && !Array.isArray(cached.matrix_data)
					? (cached.matrix_data as Record<string, unknown>)
					: {}

			const cachePayload = {
				id: cached.id,
				projectId: cached.project_id,
				accountId: cached.account_id,
				matrix: matrixData,
				insights: cached.insights ?? null,
				evidenceCount: cached.evidence_count,
				painCount: cached.pain_count,
				userGroupCount: cached.user_group_count,
				computationTimeMs: cached.computation_time_ms,
				createdAt: cached.created_at,
				lastUpdated: cached.updated_at,
				freshness,
			}

			return {
				success: true,
				message: "Fetched pain matrix cache.",
				projectId,
				accountId,
				cache: cachePayload,
			}
		} catch (err) {
			consola.error("[fetch-pain-matrix-cache] unexpected error", err)
			return {
				success: false,
				message: "Unexpected error retrieving the pain matrix cache.",
				projectId,
				accountId,
				cache: null,
			}
		}
	},
})
