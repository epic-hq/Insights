/**
 * Apply ALL system lenses to an interview
 *
 * Triggered after interview finalization to automatically apply all 6 system lenses.
 * Voice memos and notes are skipped (lens_visibility = 'private').
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import { applyLensTask } from "./applyLens"

/**
 * System lenses to apply to all interviews (except private ones)
 * Order matters - project-research first since it's most relevant
 */
const SYSTEM_LENSES = [
	"project-research", // Answers project goals, decision questions, unknowns
	"sales-bant", // Budget, Authority, Need, Timeline
	"empathy-map-jtbd", // Empathy map + Jobs-to-be-Done
	"customer-discovery", // Problem/solution validation
	"user-testing", // Usability findings
	"product-insights", // Feature requests, gaps, competitive
] as const

export type ApplyAllLensesPayload = {
	interviewId: string
	accountId: string
	projectId?: string | null
	computedBy?: string | null
	/** Optional: only apply specific lenses instead of all */
	lensesToApply?: string[]
}

export type ApplyAllLensesResult = {
	interviewId: string
	skipped: boolean
	reason?: string
	results: Array<{
		templateKey: string
		success: boolean
		error?: string
		confidenceScore?: number
	}>
}

export const applyAllLensesTask = task({
	id: "lens.apply-all-lenses",
	retry: workflowRetryConfig,
	run: async (payload: ApplyAllLensesPayload): Promise<ApplyAllLensesResult> => {
		const { interviewId, accountId, projectId, computedBy, lensesToApply } = payload
		const client = createSupabaseAdminClient()

		consola.info(`[applyAllLenses] Starting for interview ${interviewId}`)

		// Check if interview should be processed
		const { data: interview, error: interviewError } = await (client as any)
			.from("interviews")
			.select("id, lens_visibility, status")
			.eq("id", interviewId)
			.single() as { data: { id: string; lens_visibility: string | null; status: string | null } | null; error: any }

		if (interviewError || !interview) {
			throw new Error(`Interview not found: ${interviewId}`)
		}

		// Skip private interviews (voice memos, notes)
		if (interview.lens_visibility === "private") {
			consola.info(`[applyAllLenses] Skipping private interview ${interviewId}`)
			return {
				interviewId,
				skipped: true,
				reason: "private",
				results: [],
			}
		}

		// Determine which lenses to apply
		const lenses = lensesToApply || [...SYSTEM_LENSES]

		consola.info(`[applyAllLenses] Applying ${lenses.length} lenses to ${interviewId}`)

		// Apply each lens sequentially to avoid overwhelming BAML
		// In production, could use batchTriggerAndWait for parallelism
		const results: ApplyAllLensesResult["results"] = []

		for (const templateKey of lenses) {
			try {
				consola.info(`[applyAllLenses] Triggering ${templateKey}...`)

				const result = await applyLensTask.triggerAndWait({
					interviewId,
					templateKey,
					accountId,
					projectId,
					computedBy,
				})

				if (result.ok) {
					results.push({
						templateKey,
						success: true,
						confidenceScore: result.output.confidenceScore,
					})
					consola.success(`[applyAllLenses] ✓ ${templateKey} complete`)
				} else {
					results.push({
						templateKey,
						success: false,
						error: String(result.error),
					})
					consola.error(`[applyAllLenses] ✗ ${templateKey} failed:`, result.error)
				}
			} catch (error) {
				results.push({
					templateKey,
					success: false,
					error: error instanceof Error ? error.message : String(error),
				})
				consola.error(`[applyAllLenses] ✗ ${templateKey} threw:`, error)
			}
		}

		const successCount = results.filter((r) => r.success).length
		consola.info(`[applyAllLenses] Completed ${successCount}/${lenses.length} lenses for ${interviewId}`)

		return {
			interviewId,
			skipped: false,
			results,
		}
	},
})

/**
 * Export task for type inference
 */
export type ApplyAllLensesTask = typeof applyAllLensesTask
