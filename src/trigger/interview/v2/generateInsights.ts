/**
 * V2 Generate Insights Task
 *
 * Atomic task that:
 * 1. Generates insights from evidence using BAML (ExtractedInsight class)
 * 2. Stores insights as themes in themes table
 * 3. Evidence linking happens separately via theme_evidence junction table
 *
 * DATA MODEL CLARIFICATION:
 * - Themes/Insights are project-level groupings with: name, statement, inclusion_criteria
 * - Themes don't have interview_id - they're linked via theme_evidence -> evidence -> interview
 * - BAML ExtractedInsight fields (category, journey_stage, jtbd, etc.) are NOT stored
 * - Only core theme fields are persisted to keep schema simple
 * - insights_current is a VIEW over themes for backwards compatibility
 *
 * Fully idempotent - can be safely retried.
 */
import consola from "consola"
import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { generateInterviewInsightsFromEvidenceCore, workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { GenerateInsightsPayload, GenerateInsightsResult } from "./types"

export const generateInsightsTaskV2 = task({
	id: "interview.v2.generate-insights",
	retry: workflowRetryConfig,
	run: async (payload: GenerateInsightsPayload, { ctx }): Promise<GenerateInsightsResult> => {
		const { interviewId, evidenceUnits, evidenceIds, userCustomInstructions, analysisJobId, metadata } = payload
		const client = createSupabaseAdminClient()

		try {
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "insights",
				progress: 65,
				statusDetail: "Generating insights from evidence",
			})

			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "insights",
						progress: 65,
						status_detail: "Generating insights from evidence",
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			// Validate evidenceUnits
			if (!evidenceUnits || !Array.isArray(evidenceUnits)) {
				consola.error(
					`[generateInsights] Invalid evidenceUnits:`,
					`type=${typeof evidenceUnits}`,
					`isArray=${Array.isArray(evidenceUnits)}`,
					`value=${JSON.stringify(evidenceUnits)?.substring(0, 200)}`
				)
				throw new Error(
					`Invalid evidenceUnits: expected array, got ${typeof evidenceUnits}. ` +
					`Ensure evidenceUnits is properly loaded from workflow state.`
				)
			}

			consola.info(`[generateInsights] Processing ${evidenceUnits.length} evidence units`)

			// Load interview to get account_id and project_id
			const { data: interview, error: interviewError } = await client
				.from("interviews")
				.select("account_id, project_id")
				.eq("id", interviewId)
				.single()

			if (interviewError || !interview?.project_id) {
				throw new Error(`Interview ${interviewId} not found or missing project: ${interviewError?.message}`)
			}

			// Step 1: Call BAML to generate insights from evidence
			const insights = await generateInterviewInsightsFromEvidenceCore({
				evidenceUnits,
				userCustomInstructions,
			})

			// Step 2: Store insights as project-level themes
			// Note: Themes are project-level, not interview-specific
			// Link to interview comes via: theme -> theme_evidence -> evidence -> interview
			const themeRows = insights.insights.map((i) => ({
				account_id: interview.account_id,
				project_id: interview.project_id,
				name: i.name,
				statement: i.details ?? null,
				inclusion_criteria: i.evidence ?? null,
				created_by: metadata?.userId || null,
				updated_by: metadata?.userId || null,
			}))

			const { data: createdThemes, error: themeError } = await client
				.from("themes")
				.insert(themeRows)
				.select("id")

			if (themeError || !createdThemes) {
				throw new Error(`Failed to create themes: ${themeError?.message}`)
			}

			consola.success(`[generateInsights] Created ${createdThemes.length} themes/insights for interview ${interviewId}`)

			// NOTE: We intentionally do NOT create theme_evidence links here.
			// The previous implementation created N×M links (every theme to every evidence),
			// which caused over-linking and inflated evidence counts.
			//
			// Instead, evidence linking should happen via:
			// 1. "Consolidate Themes" action which uses AutoGroupThemes BAML to intelligently
			//    link specific evidence to themes with rationale and confidence scores
			// 2. Manual linking via the UI
			//
			// This keeps per-interview theme generation fast and lets consolidation
			// handle the semantic matching properly.
			consola.info(`[generateInsights] Themes created. Evidence linking deferred to consolidation.`)

			// Update workflow state
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					insightIds: createdThemes.map((t) => t.id),
					completedSteps: ["upload", "evidence", "insights"],
					currentStep: "insights",
					interviewId,
				})

				await updateAnalysisJobProgress(client, analysisJobId, {
					progress: 75,
					statusDetail: `Created ${createdThemes.length} insights`,
				})
			}

			return {
				insightIds: createdThemes.map((t) => t.id),
			}
		} catch (error) {
			// Update processing_metadata on error
			await client
				.from("interviews")
				.update({
					processing_metadata: {
						current_step: "insights",
						progress: 65,
						failed_at: new Date().toISOString(),
						error: errorMessage(error),
						trigger_run_id: ctx.run.id,
					},
				})
				.eq("id", interviewId)

			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "insights",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
