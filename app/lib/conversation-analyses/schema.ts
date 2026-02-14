import { z } from "zod";

export const conversationQuestionSchema = z.object({
	question: z.string().min(1),
	asked_by: z.string().min(1).nullable().optional(),
	intent: z.string().min(1).nullable().optional(),
	evidence_snippet: z.string().min(1).nullable().optional(),
	confidence: z.number().min(0).max(1).nullable().optional(),
});

export const participantGoalSchema = z.object({
	speaker: z.string().min(1).nullable().optional(),
	goal: z.string().min(1),
	evidence_snippet: z.string().min(1).nullable().optional(),
	confidence: z.number().min(0).max(1).nullable().optional(),
});

export const conversationTakeawaySchema = z.object({
	priority: z.enum(["high", "medium", "low"]),
	summary: z.string().min(1),
	evidence_snippets: z.array(z.string().min(1)).default([]),
	supporting_evidence_ids: z.array(z.string().min(1)).default([]),
});

export const conversationRecommendationSchema = z.object({
	focus_area: z.string().min(1),
	action: z.string().min(1),
	rationale: z.string().min(1),
});

export const conversationAnalysisSchema = z.object({
	overview: z.string().min(1),
	duration_estimate: z.string().optional().nullable(),
	questions: z.array(conversationQuestionSchema),
	participant_goals: z.array(participantGoalSchema),
	key_takeaways: z.array(conversationTakeawaySchema),
	open_questions: z.array(z.string().min(1)).default([]),
	recommended_next_steps: z.array(conversationRecommendationSchema),
});

export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;
