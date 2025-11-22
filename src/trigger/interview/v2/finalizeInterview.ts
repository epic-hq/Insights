/**
 * V2 Finalize Interview Task
 *
 * Atomic task that:
 * 1. Updates interview status to "ready"
 * 2. Sends analytics events (PostHog)
 * 3. Triggers side effects (e.g., generateSalesLensTask)
 * 4. Marks workflow as complete
 *
 * Exit point for the interview processing workflow.
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { PostHog } from "posthog-node"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { FinalizeInterviewPayload, FinalizeInterviewResult } from "./types"

// Initialize PostHog client for server-side tracking
const posthog = process.env.POSTHOG_API_KEY
	? new PostHog(process.env.POSTHOG_API_KEY, {
		host: process.env.POSTHOG_HOST || "https://app.posthog.com",
	})
	: null

export const finalizeInterviewTaskV2 = task({
	id: "interview.v2.finalize-interview",
	retry: workflowRetryConfig,
	run: async (payload: FinalizeInterviewPayload): Promise<FinalizeInterviewResult> => {
		const { interviewId, analysisJobId, metadata, evidenceIds, insightIds, fullTranscript } = payload
		const client = createSupabaseAdminClient()

		try {
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "finalize",
				progress: 95,
				statusDetail: "Finalizing interview",
			})

			// Update interview status to "ready"
			const { error: updateError } = await client
				.from("interviews")
				.update({ status: "ready", updated_at: new Date().toISOString() })
				.eq("id", interviewId)

			if (updateError) {
				consola.warn(`Failed to update interview status for ${interviewId}:`, updateError)
			}

			// Trigger side effects (e.g., sales lens generation)
			try {
				const { generateSalesLensTask } = await import("../../sales/generateSalesLens")
				await generateSalesLensTask.trigger({
					interviewId,
					computedBy: metadata?.userId ?? null,
				})
			} catch (sideEffectError) {
				consola.warn("Failed to trigger generateSalesLensTask:", sideEffectError)
				// Don't fail the task if side effect fails
			}

			// Send analytics
			try {
				if (!posthog) {
					consola.warn("[finalizeInterview] PostHog not configured, skipping analytics")
				} else {
					// Determine source and file type
					const source = metadata?.fileName
						? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
							? "upload"
							: metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
								? "upload"
								: "paste"
						: "record"

					const fileType = metadata?.fileName
						? metadata.fileName.match(/\.(mp3|wav|m4a|ogg)$/i)
							? "audio"
							: metadata.fileName.match(/\.(mp4|mov|avi|webm)$/i)
								? "video"
								: "text"
						: undefined

					// Get interview duration
					const { data: interview } = await client
						.from("interviews")
						.select("duration_sec")
						.eq("id", interviewId)
						.single()

					posthog.capture({
						distinctId: metadata?.userId || metadata?.accountId || "unknown",
						event: "interview_added",
						properties: {
							interview_id: interviewId,
							project_id: metadata?.projectId,
							account_id: metadata?.accountId,
							source,
							duration_s: interview?.duration_sec || 0,
							file_type: fileType,
							has_transcript: Boolean(fullTranscript),
							evidence_count: evidenceIds?.length || 0,
							insights_count: insightIds?.length || 0,
							$insert_id: `interview:${interviewId}:analysis`,
						},
					})

					// Update user properties for first few interviews
					if (metadata?.userId && metadata?.accountId) {
						const { count: interviewCount } = await client
							.from("interviews")
							.select("id", { count: "exact", head: true })
							.eq("account_id", metadata.accountId)

						if ((interviewCount || 0) <= 3) {
							posthog.identify({
								distinctId: metadata.userId,
								properties: {
									interview_count: interviewCount || 1,
								},
							})
						}
					}
				}
			} catch (trackingError) {
				consola.warn("[finalizeInterview] PostHog tracking failed:", trackingError)
				// Don't fail the task if analytics fail
			}

			// Update workflow state - mark as complete
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					completedSteps: ["upload", "evidence", "insights", "personas", "answers", "finalize"],
					currentStep: "finalize",
					interviewId,
				})

				// Update analysis job status
				await client
					.from("analysis_jobs")
					.update({
						status: "done",
						status_detail: "Analysis complete",
						progress: 100,
						last_error: null,
						updated_at: new Date().toISOString(),
					})
					.eq("id", analysisJobId)
			}

			return { success: true }
		} catch (error) {
			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "finalize",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
