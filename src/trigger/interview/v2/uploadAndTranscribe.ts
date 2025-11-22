/**
 * V2 Upload and Transcribe Task
 *
 * Atomic task that:
 * 1. Creates or updates interview record
 * 2. Transcribes audio if needed
 * 3. Initializes workflow state
 *
 * Entry point for the interview processing workflow.
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { uploadMediaAndTranscribeCore, workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	initializeWorkflowState,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { UploadAndTranscribePayload, UploadAndTranscribeResult } from "./types"

export const uploadAndTranscribeTaskV2 = task({
	id: "interview.v2.upload-and-transcribe",
	retry: workflowRetryConfig,
	run: async (payload: UploadAndTranscribePayload): Promise<UploadAndTranscribeResult> => {
		const { metadata, transcriptData, mediaUrl, existingInterviewId, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		try {
			// Update progress
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "upload",
				progress: 10,
				statusDetail: "Processing media and transcript",
			})

			// Call core function to handle upload and transcription
			const result = await uploadMediaAndTranscribeCore({
				metadata,
				transcriptData,
				mediaUrl,
				existingInterviewId,
				client,
			})

			// Initialize workflow state for this interview
			if (analysisJobId) {
				await initializeWorkflowState(client, analysisJobId, result.interview.id)

				// Save initial data to workflow state
				await saveWorkflowState(client, analysisJobId, {
					interviewId: result.interview.id,
					fullTranscript: result.fullTranscript,
					language: result.language,
					transcriptData: result.transcriptData,
					completedSteps: ["upload"],
					currentStep: "upload",
				})

				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 30,
					statusDetail: "Media processed successfully",
				})
			}

			return {
				interviewId: result.interview.id,
				fullTranscript: result.fullTranscript,
				language: result.language,
				transcriptData: result.transcriptData,
			}
		} catch (error) {
			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "upload",
				error: errorMessage(error),
			})

			// Update interview status to error if we have an interview ID
			if (existingInterviewId) {
				await client.from("interviews").update({ status: "error" }).eq("id", existingInterviewId)
			}

			throw error
		}
	},
})
