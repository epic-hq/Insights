/**
 * V2 Modular Interview Processing Tasks
 *
 * This module exports the refactored interview processing pipeline with:
 * - Atomic, independently retryable tasks
 * - Resume capability from any step
 * - Clear data contracts between tasks
 * - Persistent workflow state management
 *
 * @see docs/architecture/interview-processing-refactor.md
 */

// Orchestrator
export { processInterviewOrchestratorV2 } from "./orchestrator"

// Atomic Tasks
export { uploadAndTranscribeTaskV2 } from "./uploadAndTranscribe"
export { extractEvidenceTaskV2 } from "./extractEvidence"
export { generateInsightsTaskV2 } from "./generateInsights"
export { assignPersonasTaskV2 } from "./assignPersonas"
export { attributeAnswersTaskV2 } from "./attributeAnswers"
export { finalizeInterviewTaskV2 } from "./finalizeInterview"

// Types
export type {
	WorkflowState,
	WorkflowStep,
	UploadAndTranscribePayload,
	UploadAndTranscribeResult,
	ExtractEvidencePayload,
	ExtractEvidenceResult,
	GenerateInsightsPayload,
	GenerateInsightsResult,
	AssignPersonasPayload,
	AssignPersonasResult,
	AttributeAnswersPayload,
	AttributeAnswersResult,
	FinalizeInterviewPayload,
	FinalizeInterviewResult,
	ProcessInterviewOrchestratorPayload,
	ProcessInterviewOrchestratorResult,
} from "./types"

// State management utilities
export {
	loadWorkflowState,
	saveWorkflowState,
	initializeWorkflowState,
	shouldExecuteStep,
	updateAnalysisJobProgress,
	updateAnalysisJobError,
	errorMessage,
} from "./state"
