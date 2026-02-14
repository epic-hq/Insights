/**
 * Shared utility for writing AnalyzeStandaloneConversation output
 * into the conversation_lens_analyses table as a 'conversation-overview' lens.
 *
 * Used by:
 * - processInterview.server.ts (pipeline write path)
 * - api.regenerate-conversation-analysis.tsx (manual re-analysis)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { ConversationAnalysis } from "~/lib/conversation-analyses/schema";
import type { Database } from "~/types/supabase.types";

export const CONVERSATION_OVERVIEW_TEMPLATE_KEY = "conversation-overview";

/**
 * Shape stored in conversation_lens_analyses.analysis_data for the
 * conversation-overview lens. Mirrors the BAML ConversationAnalysis output.
 */
export type ConversationOverviewAnalysisData = {
	overview: string;
	duration_estimate?: string | null;
	key_takeaways: Array<{
		priority: "high" | "medium" | "low";
		summary: string;
		evidence_snippets: string[];
		supporting_evidence_ids: string[];
	}>;
	recommended_next_steps: Array<{
		focus_area: string;
		action: string;
		rationale: string;
	}>;
	open_questions: string[];
	questions: Array<{
		question: string;
		asked_by?: string | null;
		intent?: string | null;
		evidence_snippet?: string | null;
		confidence?: number | null;
	}>;
	participant_goals: Array<{
		speaker?: string | null;
		goal: string;
		evidence_snippet?: string | null;
		confidence?: number | null;
	}>;
};

/**
 * Convert a ConversationAnalysis (BAML output) into the analysis_data shape
 * stored in the lens table.
 */
export function toConversationOverviewAnalysisData(analysis: ConversationAnalysis): ConversationOverviewAnalysisData {
	return {
		overview: analysis.overview,
		duration_estimate: analysis.duration_estimate ?? null,
		key_takeaways: analysis.key_takeaways.map((t) => ({
			priority: t.priority,
			summary: t.summary,
			evidence_snippets: t.evidence_snippets ?? [],
			supporting_evidence_ids: t.supporting_evidence_ids ?? [],
		})),
		recommended_next_steps: analysis.recommended_next_steps.map((r) => ({
			focus_area: r.focus_area,
			action: r.action,
			rationale: r.rationale,
		})),
		open_questions: analysis.open_questions ?? [],
		questions: analysis.questions.map((q) => ({
			question: q.question,
			asked_by: q.asked_by ?? null,
			intent: q.intent ?? null,
			evidence_snippet: q.evidence_snippet ?? null,
			confidence: q.confidence ?? null,
		})),
		participant_goals: analysis.participant_goals.map((g) => ({
			speaker: g.speaker ?? null,
			goal: g.goal,
			evidence_snippet: g.evidence_snippet ?? null,
			confidence: g.confidence ?? null,
		})),
	};
}

/**
 * Ensure the conversation-overview template row exists in conversation_lens_templates.
 * Self-healing: creates it if missing (e.g. local dev without full seed migration).
 */
async function ensureConversationOverviewTemplate(db: SupabaseClient<Database>): Promise<void> {
	const { data, error: selectError } = await db
		.from("conversation_lens_templates")
		.select("template_key")
		.eq("template_key", CONVERSATION_OVERVIEW_TEMPLATE_KEY)
		.maybeSingle();

	if (selectError) {
		consola.error("[ensureTemplate] SELECT failed:", selectError.message);
	}

	if (data) return;

	consola.warn("[ensureTemplate] Template missing, seeding conversation-overview");
	const { error } = await db.from("conversation_lens_templates").insert({
		template_key: CONVERSATION_OVERVIEW_TEMPLATE_KEY,
		template_name: "Conversation Overview",
		summary: "Structured analysis with key takeaways, recommendations, open questions, and participant goals",
		primary_objective: "Produce a comprehensive overview of the conversation",
		category: "research",
		display_order: 1,
		template_definition: { sections: [], entities: [], recommendations_enabled: true },
		is_active: true,
		is_system: true,
		is_public: true,
	});

	if (error) {
		consola.error("[ensureTemplate] INSERT failed:", error.message, error.details, error.hint);
		throw new Error(`Cannot seed conversation-overview template: ${error.message}`);
	}
	consola.info("[ensureTemplate] Seeded conversation-overview template");
}

/**
 * Upsert the conversation analysis output into conversation_lens_analyses
 * as a 'conversation-overview' lens row.
 */
export async function upsertConversationOverviewLens({
	db,
	interviewId,
	accountId,
	projectId,
	analysis,
	computedBy,
}: {
	db: SupabaseClient<Database>;
	interviewId: string;
	accountId: string;
	projectId?: string | null;
	analysis: ConversationAnalysis;
	computedBy?: string | null;
}): Promise<{ success: boolean; error?: string }> {
	await ensureConversationOverviewTemplate(db);
	const analysisData = toConversationOverviewAnalysisData(analysis);

	const { error } = await db.from("conversation_lens_analyses").upsert(
		{
			interview_id: interviewId,
			template_key: CONVERSATION_OVERVIEW_TEMPLATE_KEY,
			account_id: accountId,
			project_id: projectId ?? null,
			analysis_data: analysisData,
			confidence_score: 0.85,
			auto_detected: true,
			status: "completed",
			processed_at: new Date().toISOString(),
			processed_by: computedBy ?? null,
		},
		{ onConflict: "interview_id,template_key" }
	);

	if (error) {
		consola.error("[upsertConversationOverviewLens] Failed:", error.message);
		return { success: false, error: error.message };
	}

	consola.info("[upsertConversationOverviewLens] Upserted for interview", interviewId, {
		keyTakeaways: analysisData.key_takeaways.length,
		recommendations: analysisData.recommended_next_steps.length,
		openQuestions: analysisData.open_questions.length,
	});

	return { success: true };
}
