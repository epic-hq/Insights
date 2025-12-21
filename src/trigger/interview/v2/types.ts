/**
 * Shared types for v2 modular interview processing tasks
 */

import type { EvidenceTurn, InterviewExtraction } from "~/../baml_client/types"
import type { Interview, InsightInsert } from "~/types"
export interface InterviewMetadata {
	accountId: string
	userId?: string
	projectId?: string
	interviewTitle?: string
	interviewDate?: string
	fileName?: string
	personName?: string
	personRole?: string
	participantName?: string
	participantOrganization?: string
	segment?: string
	skipLenses?: boolean
}

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
export type WorkflowStep = "upload" | "evidence" | "enrich-person" | "insights" | "personas" | "answers" | "finalize"

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
	fullTranscript?: string // Optional - extracted from transcript_formatted
	language: string
	analysisJobId?: string
	personKey?: string | null
	metadata?: InterviewMetadata
}

export interface ExtractEvidenceResult {
	evidenceIds: string[]
	evidenceUnits: EvidenceTurn[]
	personId: string | null
}

export interface GenerateInsightsPayload {
	interviewId: string
	evidenceUnits: EvidenceTurn[]
	evidenceIds: string[] // Database IDs of the evidence rows
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
	evidenceUnits: EvidenceTurn[]
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
