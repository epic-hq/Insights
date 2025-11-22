/**
 * V2 Process Interview Orchestrator
 *
 * Coordinates the entire interview processing workflow:
 * 1. Upload & Transcribe
 * 2. Extract Evidence
 * 3. Generate Insights (themes)
 * 4. Assign Personas (parallel with answers)
 * 5. Attribute Answers (parallel with personas)
 * 6. Finalize Interview
 *
 * Key features:
 * - Resume from any step
 * - Skip steps for testing
 * - Persistent state management
 * - Independent task retry
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import { uploadAndTranscribeTaskV2 } from "./uploadAndTranscribe"
import { extractEvidenceTaskV2 } from "./extractEvidence"
import { generateInsightsTaskV2 } from "./generateInsights"
import { assignPersonasTaskV2 } from "./assignPersonas"
import { attributeAnswersTaskV2 } from "./attributeAnswers"
import { finalizeInterviewTaskV2 } from "./finalizeInterview"
import {
	loadWorkflowState,
	saveWorkflowState,
	initializeWorkflowState,
	shouldExecuteStep,
	updateAnalysisJobError,
	errorMessage,
} from "./state"
import type {
	ProcessInterviewOrchestratorPayload,
	ProcessInterviewOrchestratorResult,
	WorkflowState,
	WorkflowStep,
} from "./types"

export const processInterviewOrchestratorV2 = task({
	id: "interview.v2.orchestrator",
	retry: workflowRetryConfig,
	run: async (
		payload: ProcessInterviewOrchestratorPayload
	): Promise<ProcessInterviewOrchestratorResult> => {
		const {
			metadata,
			mediaUrl,
			transcriptData,
			existingInterviewId,
			analysisJobId,
			userCustomInstructions,
			resumeFrom,
			skipSteps = [],
		} = payload

		const client = createSupabaseAdminClient()

		if (!analysisJobId) {
			throw new Error("analysisJobId is required for orchestrator")
		}

		// Load or initialize state
		let state = await loadWorkflowState(client, analysisJobId)

		if (!state) {
			// Initialize new workflow
			consola.info(`[Orchestrator] Initializing new workflow for job ${analysisJobId}`)
			state = {
				interviewId: existingInterviewId || "",
				completedSteps: [],
				currentStep: "upload",
				lastUpdated: new Date().toISOString(),
			}
		} else {
			consola.info(
				`[Orchestrator] Resuming workflow for job ${analysisJobId}`,
				`Current step: ${state.currentStep}`,
				`Completed: ${state.completedSteps.join(", ")}`
			)
		}

		// Determine starting point
		const startFrom = resumeFrom || "upload"

		// Validate required data for resume points
		if (startFrom === "evidence" && !state.fullTranscript) {
			// Need to load transcript from interview record
			const { data: interview } = await client
				.from("interviews")
				.select("transcript, transcript_formatted")
				.eq("id", state.interviewId)
				.single()

			if (interview) {
				const transcriptFormatted = interview.transcript_formatted as any
				state.fullTranscript = interview.transcript || ""
				state.language = transcriptFormatted?.language || transcriptFormatted?.detected_language || "en"
				state.transcriptData = transcriptData || (transcriptFormatted as Record<string, unknown>)
			}
		}

		// Validate required data for insights step
		if (startFrom === "insights" && !state.evidenceUnits) {
			consola.error(
				`[Orchestrator] Cannot resume from 'insights' - evidenceUnits missing from state`,
				`State has: ${Object.keys(state).join(", ")}`
			)
			throw new Error(
				"Cannot resume from 'insights' step: evidenceUnits not found in workflow state. " +
				"Please ensure the state is properly initialized before resuming."
			)
		}

		try {
			// Step 1: Upload & Transcribe
			if (
				shouldExecuteStep("upload", startFrom, state) &&
				!skipSteps.includes("upload")
			) {
				consola.info("[Orchestrator] Executing: Upload & Transcribe")

				const result = await uploadAndTranscribeTaskV2.triggerAndWait({
					metadata,
					mediaUrl,
					transcriptData,
					existingInterviewId: state.interviewId || existingInterviewId,
					analysisJobId,
				})

				// Update state
				state.interviewId = result.interviewId
				state.fullTranscript = result.fullTranscript
				state.language = result.language
				state.transcriptData = result.transcriptData
				state.completedSteps = [...new Set([...state.completedSteps, "upload"])]
				state.currentStep = "upload"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Upload & Transcribe complete")
			} else {
				consola.info("[Orchestrator] Skipping: Upload & Transcribe")
			}

			// Step 2: Extract Evidence
			if (
				shouldExecuteStep("evidence", startFrom, state) &&
				!skipSteps.includes("evidence")
			) {
				consola.info("[Orchestrator] Executing: Extract Evidence")

				const result = await extractEvidenceTaskV2.triggerAndWait({
					interviewId: state.interviewId,
					fullTranscript: state.fullTranscript!,
					language: state.language!,
					analysisJobId,
				})

				// Update state
				state.evidenceIds = result.evidenceIds
				state.evidenceUnits = result.evidenceUnits
				state.personId = result.personId || undefined
				state.completedSteps = [...new Set([...state.completedSteps, "evidence"])]
				state.currentStep = "evidence"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Extract Evidence complete")
			} else {
				consola.info("[Orchestrator] Skipping: Extract Evidence")
			}

			// Step 3: Generate Insights (themes)
			if (
				shouldExecuteStep("insights", startFrom, state) &&
				!skipSteps.includes("insights")
			) {
				consola.info("[Orchestrator] Executing: Generate Insights")

				const result = await generateInsightsTaskV2.triggerAndWait({
					interviewId: state.interviewId,
					evidenceUnits: state.evidenceUnits!,
					userCustomInstructions,
					analysisJobId,
					metadata,
				})

				// Update state
				state.insightIds = result.insightIds
				state.completedSteps = [...new Set([...state.completedSteps, "insights"])]
				state.currentStep = "insights"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Generate Insights complete")
			} else {
				consola.info("[Orchestrator] Skipping: Generate Insights")
			}

			// Steps 4 & 5: Assign Personas + Attribute Answers (can run in parallel in future)
			// For now, run sequentially for simplicity

			// Step 4: Assign Personas
			if (
				shouldExecuteStep("personas", startFrom, state) &&
				!skipSteps.includes("personas")
			) {
				consola.info("[Orchestrator] Executing: Assign Personas")

				const result = await assignPersonasTaskV2.triggerAndWait({
					interviewId: state.interviewId,
					projectId: metadata.projectId,
					personId: state.personId || null,
					evidenceUnits: state.evidenceUnits!,
					analysisJobId,
				})

				// Update state
				state.personaIds = result.personaIds
				state.completedSteps = [...new Set([...state.completedSteps, "personas"])]
				state.currentStep = "personas"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Assign Personas complete")
			} else {
				consola.info("[Orchestrator] Skipping: Assign Personas")
			}

			// Step 5: Attribute Answers
			if (
				shouldExecuteStep("answers", startFrom, state) &&
				!skipSteps.includes("answers")
			) {
				consola.info("[Orchestrator] Executing: Attribute Answers")

				await attributeAnswersTaskV2.triggerAndWait({
					interviewId: state.interviewId,
					projectId: metadata.projectId,
					evidenceIds: state.evidenceIds!,
					analysisJobId,
				})

				// Update state
				state.completedSteps = [...new Set([...state.completedSteps, "answers"])]
				state.currentStep = "answers"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Attribute Answers complete")
			} else {
				consola.info("[Orchestrator] Skipping: Attribute Answers")
			}

			// Step 6: Finalize Interview
			if (
				shouldExecuteStep("finalize", startFrom, state) &&
				!skipSteps.includes("finalize")
			) {
				consola.info("[Orchestrator] Executing: Finalize Interview")

				await finalizeInterviewTaskV2.triggerAndWait({
					interviewId: state.interviewId,
					analysisJobId,
					metadata,
					evidenceIds: state.evidenceIds,
					insightIds: state.insightIds,
					fullTranscript: state.fullTranscript,
				})

				// Update state
				state.completedSteps = [...new Set([...state.completedSteps, "finalize"])]
				state.currentStep = "finalize"

				await saveWorkflowState(client, analysisJobId, state)
				consola.success("[Orchestrator] ✓ Finalize Interview complete")
			} else {
				consola.info("[Orchestrator] Skipping: Finalize Interview")
			}

			consola.success(
				`[Orchestrator] Workflow complete for interview ${state.interviewId}`,
				`Completed steps: ${state.completedSteps.join(", ")}`
			)

			return {
				success: true,
				interviewId: state.interviewId,
				completedSteps: state.completedSteps,
			}
		} catch (error) {
			// Save state even on error so we can resume
			await saveWorkflowState(client, analysisJobId, state)

			consola.error(
				`[Orchestrator] Workflow failed at step ${state.currentStep}`,
				errorMessage(error)
			)

			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: state.currentStep,
				error: errorMessage(error),
			})

			throw error
		}
	},
})
