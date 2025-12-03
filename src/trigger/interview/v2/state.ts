/**
 * State management utilities for v2 modular interview processing
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"
import type { WorkflowState, WorkflowStep } from "./types"

/**
 * Load workflow state from interviews.conversation_analysis
 * @param analysisJobId - Now the interview ID (analysis_jobs table was consolidated)
 */
export async function loadWorkflowState(
	db: SupabaseClient<Database>,
	analysisJobId: string
): Promise<WorkflowState | null> {
	const interviewId = analysisJobId // analysisJobId is now interview ID

	const { data, error } = await db
		.from("interviews")
		.select("conversation_analysis")
		.eq("id", interviewId)
		.single()

	if (error) {
		consola.error(`Failed to load workflow state for interview ${interviewId}:`, error)
		return null
	}

	if (!data) {
		return null
	}

	// Parse conversation_analysis JSONB
	const conversationAnalysis = data.conversation_analysis as any
	if (!conversationAnalysis) {
		consola.warn(`Conversation analysis is null for interview ${interviewId}`)
		return null
	}

	// Extract workflow_state from conversation_analysis
	const state = conversationAnalysis.workflow_state as WorkflowState | null

	if (!state) {
		consola.warn(`Workflow state is null for interview ${interviewId}, but conversation_analysis exists`)
		return null
	}

	// Merge with top-level fields for backward compatibility
	const mergedState = {
		...state,
		completedSteps: conversationAnalysis.completed_steps || state.completedSteps || [],
		currentStep: conversationAnalysis.current_step || state.currentStep || "",
	}

	consola.info(
		`[loadWorkflowState] Loaded state for interview ${interviewId}:`,
		`interviewId=${mergedState.interviewId}`,
		`evidenceUnits=${mergedState.evidenceUnits?.length ?? 'undefined'}`,
		`evidenceIds=${mergedState.evidenceIds?.length ?? 'undefined'}`,
		`completedSteps=${mergedState.completedSteps.join(',')}`
	)

	return mergedState
}

/**
 * Save workflow state to interviews.conversation_analysis
 * @param analysisJobId - Now the interview ID (analysis_jobs table was consolidated)
 */
export async function saveWorkflowState(
	db: SupabaseClient<Database>,
	analysisJobId: string,
	state: Partial<WorkflowState>
): Promise<void> {
	const interviewId = analysisJobId // analysisJobId is now interview ID
	const now = new Date().toISOString()

	consola.info(`[saveWorkflowState] Saving state for interview ${interviewId}`)
	consola.info(`[saveWorkflowState] Incoming state:`, {
		interviewId: state.interviewId || "MISSING",
		completedSteps: state.completedSteps,
		currentStep: state.currentStep,
		hasFullTranscript: !!state.fullTranscript,
	})

	// Load existing state
	const existing = await loadWorkflowState(db, interviewId)

	consola.info(`[saveWorkflowState] Existing state:`, {
		interviewId: existing?.interviewId || "MISSING",
		completedSteps: existing?.completedSteps,
		currentStep: existing?.currentStep,
	})

	// Merge with existing state - only overwrite defined values
	const merged: WorkflowState = {
		...(existing || {}),
		lastUpdated: now,
	} as WorkflowState

	// Only merge in defined values from incoming state
	if (state.interviewId !== undefined) merged.interviewId = state.interviewId
	if (state.fullTranscript !== undefined) merged.fullTranscript = state.fullTranscript
	if (state.language !== undefined) merged.language = state.language
	if (state.transcriptData !== undefined) merged.transcriptData = state.transcriptData
	if (state.evidenceIds !== undefined) merged.evidenceIds = state.evidenceIds
	if (state.evidenceUnits !== undefined) merged.evidenceUnits = state.evidenceUnits
	if (state.personId !== undefined) merged.personId = state.personId
	if (state.insightIds !== undefined) merged.insightIds = state.insightIds
	if (state.personaIds !== undefined) merged.personaIds = state.personaIds
	if (state.completedSteps !== undefined) merged.completedSteps = state.completedSteps
	if (state.currentStep !== undefined) merged.currentStep = state.currentStep

	consola.info(`[saveWorkflowState] Merged state:`, {
		interviewId: merged.interviewId || "MISSING",
		completedSteps: merged.completedSteps,
		currentStep: merged.currentStep,
		hasFullTranscript: !!merged.fullTranscript,
	})

	// Get current conversation_analysis to preserve other data
	const { data: currentInterview } = await db
		.from("interviews")
		.select("conversation_analysis")
		.eq("id", interviewId)
		.single()

	const existingAnalysis = (currentInterview?.conversation_analysis as any) || {}

	const { error } = await db
		.from("interviews")
		.update({
			conversation_analysis: {
				...existingAnalysis,
				workflow_state: merged as any,
				completed_steps: merged.completedSteps,
				current_step: merged.currentStep,
			},
			updated_at: now,
		})
		.eq("id", interviewId)

	if (error) {
		consola.error(`Failed to save workflow state for interview ${interviewId}:`, error)
		throw new Error(`Failed to save workflow state: ${error.message}`)
	}

	consola.success(`[saveWorkflowState] State saved successfully for interview ${interviewId}`)
}

/**
 * Initialize workflow state for a new analysis job
 */
export async function initializeWorkflowState(
	db: SupabaseClient<Database>,
	analysisJobId: string,
	interviewId: string
): Promise<WorkflowState> {
	const state: WorkflowState = {
		interviewId,
		completedSteps: [],
		currentStep: "upload",
		lastUpdated: new Date().toISOString(),
	}

	await saveWorkflowState(db, analysisJobId, state)

	return state
}

/**
 * Update interview conversation_analysis progress
 * @param analysisJobId - Now the interview ID (analysis_jobs table was consolidated)
 */
export async function updateAnalysisJobProgress(
	db: SupabaseClient<Database>,
	analysisJobId: string | undefined,
	update: {
		currentStep?: string
		progress?: number
		statusDetail?: string
	}
): Promise<void> {
	if (!analysisJobId) return

	const interviewId = analysisJobId

	// Get current conversation_analysis
	const { data: interview } = await db
		.from("interviews")
		.select("conversation_analysis")
		.eq("id", interviewId)
		.single()

	const existingAnalysis = (interview?.conversation_analysis as any) || {}

	const { error } = await db
		.from("interviews")
		.update({
			conversation_analysis: {
				...existingAnalysis,
				current_step: update.currentStep,
				progress: update.progress,
				status_detail: update.statusDetail,
			},
			updated_at: new Date().toISOString(),
		})
		.eq("id", interviewId)

	if (error) {
		consola.warn(`Failed to update interview progress for ${interviewId}:`, error)
	}
}

/**
 * Update interview conversation_analysis with error
 * @param analysisJobId - Now the interview ID (analysis_jobs table was consolidated)
 */
export async function updateAnalysisJobError(
	db: SupabaseClient<Database>,
	analysisJobId: string | undefined,
	update: {
		currentStep: string
		error: string
	}
): Promise<void> {
	if (!analysisJobId) return

	const interviewId = analysisJobId

	// Get current conversation_analysis
	const { data: interview } = await db
		.from("interviews")
		.select("conversation_analysis")
		.eq("id", interviewId)
		.single()

	const existingAnalysis = (interview?.conversation_analysis as any) || {}

	const { error } = await db
		.from("interviews")
		.update({
			status: "error",
			conversation_analysis: {
				...existingAnalysis,
				current_step: update.currentStep,
				last_error: update.error,
			},
			updated_at: new Date().toISOString(),
		})
		.eq("id", interviewId)

	if (error) {
		consola.warn(`Failed to update interview error for ${interviewId}:`, error)
	}
}

/**
 * Check if a workflow step should be executed
 */
export function shouldExecuteStep(
	step: WorkflowStep,
	resumeFrom: WorkflowStep | undefined,
	state: WorkflowState
): boolean {
	// If resumeFrom is specified, skip all steps before it
	if (resumeFrom) {
		const stepOrder: WorkflowStep[] = ["upload", "evidence", "insights", "personas", "answers", "finalize"]
		const resumeIndex = stepOrder.indexOf(resumeFrom)
		const currentIndex = stepOrder.indexOf(step)

		// Skip if current step comes before resume point
		if (currentIndex < resumeIndex) {
			return false
		}
	}

	// Skip if step already completed (unless we're resuming from this step)
	if (state.completedSteps.includes(step) && resumeFrom !== step) {
		return false
	}

	return true
}

/**
 * Helper to format error messages
 */
export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
