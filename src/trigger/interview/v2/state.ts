/**
 * State management utilities for v2 modular interview processing
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"
import type { WorkflowState, WorkflowStep } from "./types"

/**
 * Load workflow state from analysis_jobs table
 */
export async function loadWorkflowState(
	db: SupabaseClient<Database>,
	analysisJobId: string
): Promise<WorkflowState | null> {
	const { data, error } = await db
		.from("analysis_jobs")
		.select("workflow_state, completed_steps, current_step")
		.eq("id", analysisJobId)
		.single()

	if (error) {
		consola.error(`Failed to load workflow state for job ${analysisJobId}:`, error)
		return null
	}

	if (!data) {
		return null
	}

	// Parse workflow_state from JSONB
	const state = data.workflow_state as WorkflowState | null

	if (!state) {
		consola.warn(`Workflow state is null for job ${analysisJobId}, but row exists`)
		return null
	}

	// Merge with top-level fields for backward compatibility
	const mergedState = {
		...state,
		completedSteps: data.completed_steps || state.completedSteps || [],
		currentStep: data.current_step || state.currentStep || "",
	}

	consola.info(
		`[loadWorkflowState] Loaded state for job ${analysisJobId}:`,
		`interviewId=${mergedState.interviewId}`,
		`evidenceUnits=${mergedState.evidenceUnits?.length ?? 'undefined'}`,
		`evidenceIds=${mergedState.evidenceIds?.length ?? 'undefined'}`,
		`completedSteps=${mergedState.completedSteps.join(',')}`
	)

	return mergedState
}

/**
 * Save workflow state to analysis_jobs table
 */
export async function saveWorkflowState(
	db: SupabaseClient<Database>,
	analysisJobId: string,
	state: Partial<WorkflowState>
): Promise<void> {
	const now = new Date().toISOString()

	// Load existing state
	const existing = await loadWorkflowState(db, analysisJobId)

	// Merge with existing state
	const merged: WorkflowState = {
		...(existing || {}),
		...state,
		lastUpdated: now,
	} as WorkflowState

	const { error } = await db
		.from("analysis_jobs")
		.update({
			workflow_state: merged as any,
			completed_steps: merged.completedSteps,
			current_step: merged.currentStep,
			updated_at: now,
		})
		.eq("id", analysisJobId)

	if (error) {
		consola.error(`Failed to save workflow state for job ${analysisJobId}:`, error)
		throw new Error(`Failed to save workflow state: ${error.message}`)
	}
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
 * Update analysis job progress
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

	const { error } = await db
		.from("analysis_jobs")
		.update({
			current_step: update.currentStep,
			progress: update.progress,
			status_detail: update.statusDetail,
			updated_at: new Date().toISOString(),
		})
		.eq("id", analysisJobId)

	if (error) {
		consola.warn(`Failed to update analysis job progress for ${analysisJobId}:`, error)
	}
}

/**
 * Update analysis job error
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

	const { error } = await db
		.from("analysis_jobs")
		.update({
			status: "error",
			current_step: update.currentStep,
			last_error: update.error,
			updated_at: new Date().toISOString(),
		})
		.eq("id", analysisJobId)

	if (error) {
		consola.warn(`Failed to update analysis job error for ${analysisJobId}:`, error)
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
