/**
 * Shared types for v2 modular interview processing tasks
 */

import type { EvidenceTurn, InterviewExtraction } from "~/../baml_client/types"
import type { Interview, InsightInsert } from "~/types"
import type { InterviewMetadata } from "~/utils/processInterview.server"

/**
 * Workflow state stored in analysis_jobs.workflow_state
 */
export interface WorkflowState {
	// Core data
	interviewId: string
	fullTranscript?: string
	language?: string
	transcriptData?: Record<string, unknown>

	// Step outputs
	evidenceIds?: string[]
	evidenceUnits?: EvidenceTurn[]
	personId?: string
	insightIds?: string[] // IDs from themes table (exposed via insights view)
	personaIds?: string[]

	// Progress tracking
	completedSteps: string[]
	currentStep: string
	lastUpdated: string
}

/**
 * Valid workflow steps
 */
export type WorkflowStep = "upload" | "evidence" | "insights" | "personas" | "answers" | "finalize"

/**
 * Task payloads for each atomic task
 */

export interface UploadAndTranscribePayload {
	metadata: InterviewMetadata
	mediaUrl: string
	transcriptData?: Record<string, unknown>
	existingInterviewId?: string
	analysisJobId?: string
}

export interface UploadAndTranscribeResult {
	interviewId: string
	fullTranscript: string
	language: string
	transcriptData: Record<string, unknown>
}

export interface ExtractEvidencePayload {
	interviewId: string
	fullTranscript: string
	language: string
	analysisJobId?: string
}

export interface ExtractEvidenceResult {
	evidenceIds: string[]
	evidenceUnits: EvidenceUnit[]
	personId: string | null
}

export interface GenerateInsightsPayload {
	interviewId: string
	evidenceUnits: EvidenceUnit[]
	userCustomInstructions?: string
	analysisJobId?: string
	metadata?: InterviewMetadata
}

export interface GenerateInsightsResult {
	insightIds: string[]
}

export interface AssignPersonasPayload {
	interviewId: string
	projectId: string
	personId: string | null
	evidenceUnits: EvidenceUnit[]
	analysisJobId?: string
}

export interface AssignPersonasResult {
	personaIds: string[]
}

export interface AttributeAnswersPayload {
	interviewId: string
	projectId: string
	evidenceIds: string[]
	analysisJobId?: string
}

export interface AttributeAnswersResult {
	attributedCount: number
}

export interface FinalizeInterviewPayload {
	interviewId: string
	analysisJobId?: string
	metadata?: InterviewMetadata
	evidenceIds?: string[]
	insightIds?: string[]
	fullTranscript?: string
}

export interface FinalizeInterviewResult {
	success: boolean
}

/**
 * Orchestrator payload
 */
export interface ProcessInterviewOrchestratorPayload {
	metadata: InterviewMetadata
	mediaUrl: string
	transcriptData?: Record<string, unknown>
	existingInterviewId?: string
	analysisJobId?: string
	userCustomInstructions?: string

	// Resume capability
	resumeFrom?: WorkflowStep
	skipSteps?: WorkflowStep[] // Optional: skip specific steps (e.g., for testing)
}

export interface ProcessInterviewOrchestratorResult {
	success: boolean
	interviewId: string
	completedSteps: string[]
}
