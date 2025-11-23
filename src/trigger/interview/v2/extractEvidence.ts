/**
 * V2 Extract Evidence Task
 *
 * Atomic task that extracts evidence units and people from interview transcript.
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { extractEvidenceAndPeopleCore, workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { ExtractEvidencePayload, ExtractEvidenceResult } from "./types"

export const extractEvidenceTaskV2 = task({
	id: "interview.v2.extract-evidence",
	retry: workflowRetryConfig,
	run: async (payload: ExtractEvidencePayload): Promise<ExtractEvidenceResult> => {
		const { interviewId, fullTranscript, language, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		consola.info("[extractEvidence] Task started with payload:", {
			interviewId,
			fullTranscriptLength: fullTranscript?.length ?? 0,
			language,
			analysisJobId,
		})

		// Validate payload
		if (!interviewId || interviewId === "undefined") {
			const errorMsg = `Invalid interviewId received: "${interviewId}". ` +
				`This indicates a bug in the orchestrator or state management. ` +
				`Full payload: ${JSON.stringify(payload, null, 2)}`
			consola.error("[extractEvidence]", errorMsg)
			throw new Error(errorMsg)
		}

		try {
			// Update progress
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "evidence",
				progress: 40,
				statusDetail: "Extracting evidence from transcript",
			})

			// Load interview data
			consola.info(`[extractEvidence] Loading interview: ${interviewId}`)
			const { data: interview, error: interviewError } = await client
				.from("interviews")
				.select("*")
				.eq("id", interviewId)
				.single()

			if (interviewError || !interview) {
				throw new Error(`Interview ${interviewId} not found: ${interviewError?.message}`)
			}

			consola.success(`[extractEvidence] Loaded interview: ${interview.id}`)

			// Delete existing evidence for idempotency
			const { error: deleteError } = await client.from("evidence").delete().eq("interview_id", interviewId)

			if (deleteError) {
				console.warn(`Failed to delete existing evidence for ${interviewId}:`, deleteError)
			}

			// Extract evidence with timestamps (reuse existing core function)
			const evidenceResult = await extractEvidenceAndPeopleCore({
				db: client,
				metadata: {
					accountId: interview.account_id,
					projectId: interview.project_id || undefined,
				},
				interviewRecord: interview as any,
				transcriptData: interview.transcript_formatted as any,
				language,
				fullTranscript,
			})

			// Update workflow state
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					evidenceIds: evidenceResult.insertedEvidenceIds,
					evidenceUnits: evidenceResult.evidenceUnits,
					personId: evidenceResult.personData?.id || null,
					completedSteps: ["upload", "evidence"],
					currentStep: "evidence",
					interviewId,
				})

				// Update evidence count
				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 55,
					statusDetail: `Extracted ${evidenceResult.insertedEvidenceIds.length} evidence units`,
				})

				await client
					.from("analysis_jobs")
					.update({ evidence_count: evidenceResult.insertedEvidenceIds.length })
					.eq("id", analysisJobId)
			}

			return {
				evidenceIds: evidenceResult.insertedEvidenceIds,
				evidenceUnits: evidenceResult.evidenceUnits,
				personId: evidenceResult.personData?.id || null,
			}
		} catch (error) {
			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "evidence",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
