/**
 * Typed content schemas for annotations
 *
 * Annotations can store different types of structured data:
 * - AI suggestions: Use content_jsonb for structured recommendations
 * - Comments/Notes: Use content (text) for human-readable text
 * - Todos: Use content_jsonb for checklists and metadata
 * - Reactions: Use reaction_type field
 */

// =============================================================================
// AI SUGGESTION CONTENT
// =============================================================================

export type AISuggestionType =
	| "opportunity_advice"
	| "deal_analysis"
	| "insight_recommendation"
	| "persona_analysis"
	| "interview_summary"
	| "research_guidance"

export interface OpportunityAdviceContent {
	suggestion_type: "opportunity_advice"
	version: number
	model: string
	generated_at: string
	supersedes_annotation_id?: string

	// Opportunity-specific fields
	status_assessment: string
	recommendations: string[]
	risks: string[]
	confidence: "high" | "medium" | "low"

	// Optional context
	stakeholder_count?: number
	next_steps_count?: number
	interviews_analyzed?: number
}

export interface InsightRecommendationContent {
	suggestion_type: "insight_recommendation"
	version: number
	model: string
	generated_at: string
	supersedes_annotation_id?: string

	// Insight-specific fields
	insight_text: string
	supporting_evidence: string[]
	actionability_score?: number // 0-100
	affected_personas?: string[]
	priority?: "low" | "medium" | "high" | "critical"
}

export interface PersonaAnalysisContent {
	suggestion_type: "persona_analysis"
	version: number
	model: string
	generated_at: string
	supersedes_annotation_id?: string

	// Persona-specific fields
	summary: string
	pain_points: string[]
	unmet_needs: string[]
	opportunities: string[]
	confidence: "high" | "medium" | "low"
}

export type AISuggestionContent =
	| OpportunityAdviceContent
	| InsightRecommendationContent
	| PersonaAnalysisContent

// =============================================================================
// TODO CONTENT
// =============================================================================

export interface TodoChecklistItem {
	id: string
	text: string
	completed: boolean
	completed_at?: string
	completed_by?: string
}

export interface TodoContent {
	checklist?: TodoChecklistItem[]
	assignee_ids?: string[]
	priority?: "low" | "medium" | "high" | "urgent"
	labels?: string[]
	estimated_hours?: number
	context?: string // Additional context/description
}

// =============================================================================
// NOTE CONTENT
// =============================================================================

export interface NoteContent {
	tags?: string[]
	color?: string
	position?: { x: number; y: number } // For canvas-based UIs
	formatting?: "markdown" | "plain" | "rich"
	pinned?: boolean
}

// =============================================================================
// COMMENT CONTENT (minimal - mostly uses text field)
// =============================================================================

export interface CommentContent {
	mentions?: Array<{
		user_id: string
		display_name: string
		offset: number // Character position in text
	}>
	edited?: boolean
	edited_at?: string
}

// =============================================================================
// UNION TYPE
// =============================================================================

export type AnnotationContentJsonb =
	| AISuggestionContent
	| TodoContent
	| NoteContent
	| CommentContent
	| null

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isOpportunityAdvice(
	content: unknown
): content is OpportunityAdviceContent {
	return (
		typeof content === "object" &&
		content !== null &&
		"suggestion_type" in content &&
		content.suggestion_type === "opportunity_advice"
	)
}

export function isInsightRecommendation(
	content: unknown
): content is InsightRecommendationContent {
	return (
		typeof content === "object" &&
		content !== null &&
		"suggestion_type" in content &&
		content.suggestion_type === "insight_recommendation"
	)
}

export function isPersonaAnalysis(
	content: unknown
): content is PersonaAnalysisContent {
	return (
		typeof content === "object" &&
		content !== null &&
		"suggestion_type" in content &&
		content.suggestion_type === "persona_analysis"
	)
}

export function isTodoContent(content: unknown): content is TodoContent {
	return (
		typeof content === "object" &&
		content !== null &&
		("checklist" in content || "assignee_ids" in content || "priority" in content)
	)
}

// =============================================================================
// HELPER TYPES
// =============================================================================

export interface AnnotationWithTypedContent<T extends AnnotationContentJsonb> {
	id: string
	account_id: string
	project_id: string
	entity_type: string
	entity_id: string
	annotation_type: string
	content: string | null
	content_jsonb: T
	metadata: Record<string, unknown> | null
	created_by_user_id: string | null
	created_by_ai: boolean | null
	ai_model: string | null
	status: string | null
	visibility: string | null
	parent_annotation_id: string | null
	thread_root_id: string | null
	created_at: string | null
	updated_at: string | null
	updated_by_user_id: string | null
	resolved_at: string | null
	resolved_by_user_id: string | null
	due_date: string | null
	reaction_type: string | null
}
