import { z } from "zod"

/**
 * Shared Zod schema describing the structured conversation analysis we persist in Supabase
 * and surface back to the UI. These schemas keep the BAML output, Trigger task, and React
 * components aligned while giving us type inference for free.
 */
export const conversationQuestionSchema = z.object({
	question: z.string().min(1, "Question text is required"),
	asked_by: z.string().min(1).nullable().optional(),
	intent: z.string().min(1).nullable().optional(),
	evidence_snippet: z.string().min(1).nullable().optional(),
	confidence: z.number().min(0).max(1).nullable().optional(),
})

export const participantGoalSchema = z.object({
	speaker: z.string().min(1).nullable().optional(),
	goal: z.string().min(1, "Goal description is required"),
	evidence_snippet: z.string().min(1).nullable().optional(),
	confidence: z.number().min(0).max(1).nullable().optional(),
})

export const conversationTakeawaySchema = z.object({
	priority: z.enum(["high", "medium", "low"]),
	summary: z.string().min(1),
	evidence_snippets: z.array(z.string().min(1)).default([]),
})

export const conversationRecommendationSchema = z.object({
	focus_area: z.string().min(1),
	action: z.string().min(1),
	rationale: z.string().min(1),
})

export const conversationAnalysisSchema = z.object({
	overview: z.string().min(1),
	duration_estimate: z.string().optional().nullable(),
	questions: z.array(conversationQuestionSchema),
	participant_goals: z.array(participantGoalSchema),
	key_takeaways: z.array(conversationTakeawaySchema),
	open_questions: z.array(z.string().min(1)).default([]),
	recommended_next_steps: z.array(conversationRecommendationSchema),
})

export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>
export type ConversationQuestion = z.infer<typeof conversationQuestionSchema>
export type ParticipantGoal = z.infer<typeof participantGoalSchema>
export type ConversationTakeaway = z.infer<typeof conversationTakeawaySchema>
export type ConversationRecommendation = z.infer<typeof conversationRecommendationSchema>

export const conversationAnalysisRecordSchema = z.object({
	id: z.string().uuid(),
	account_id: z.string().uuid(),
	created_at: z.string(),
	created_by: z.string().uuid().nullable(),
	recording_url: z.string().url(),
	transcript: z.string().nullable(),
	status: z.enum(["pending", "processing", "completed", "failed"]),
	summary: z.string().nullable(),
	detected_questions: z.any().nullable(),
	participant_goals: z.any().nullable(),
	key_takeaways: z.any().nullable(),
	open_questions: z.any().nullable(),
	recommendations: z.any().nullable(),
	duration_seconds: z.number().nullable(),
	error_message: z.string().nullable(),
	updated_at: z.string(),
})

export type ConversationAnalysisRecord = z.infer<typeof conversationAnalysisRecordSchema>
