/**
 * V2 Attribute Answers Task
 *
 * Atomic task that:
 * 1. Runs evidence analysis for the project
 * 2. Attributes evidence to project questions/answers
 * 3. Can run in parallel with assignPersonasTask
 *
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { AttributeAnswersPayload, AttributeAnswersResult } from "./types"

export const attributeAnswersTaskV2 = task({
	id: "interview.v2.attribute-answers",
	retry: workflowRetryConfig,
	run: async (payload: AttributeAnswersPayload, { ctx }): Promise<AttributeAnswersResult> => {
		const { interviewId, projectId, evidenceIds, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		try {
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "answers",
				progress: 85,
				statusDetail: "Attributing answers to questions",
			})

			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "answers",
						progress: 85,
						status_detail: "Attributing answers to questions",
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			// Run evidence analysis to attribute evidence to project questions
			let attributedCount = 0

			if (projectId) {
				try {
					await runEvidenceAnalysis({
						supabase: client,
						projectId,
						interviewId,
					})

					// Count how many evidence pieces were attributed
					const { count } = await client
						.from("project_answer_evidence")
						.select("*", { count: "exact", head: true })
						.in("evidence_id", evidenceIds)

					attributedCount = count || 0

					consola.info(`Attributed ${attributedCount} evidence pieces to project answers`)
				} catch (analysisError) {
					consola.warn("[attributeAnswers] Evidence analysis failed:", analysisError)
					// Don't fail the task if evidence analysis fails
				}
			}

			// Update workflow state
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					completedSteps: ["upload", "evidence", "insights", "personas", "answers"],
					currentStep: "answers",
					interviewId,
				})

				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 90,
					statusDetail: `Attributed ${attributedCount} evidence pieces`,
				})
			}

			return {
				attributedCount,
			}
		} catch (error) {
			// Update processing_metadata on error
			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "answers",
						progress: 85,
						failed_at: new Date().toISOString(),
						error: errorMessage(error),
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "answers",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
