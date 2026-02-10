/**
 * Parses conversation analysis data into a typed display structure
 * used by the interview detail page.
 *
 * Primary source: conversation_lens_analyses row with template_key = 'conversation-overview'
 * Fallback: legacy interviews.conversation_analysis JSONB (for un-migrated interviews)
 */

import type { ConversationOverviewAnalysisData } from "~/lib/conversation-analyses/upsertConversationOverviewLens.server";
import { CONVERSATION_OVERVIEW_TEMPLATE_KEY } from "~/lib/conversation-analyses/upsertConversationOverviewLens.server";

export { CONVERSATION_OVERVIEW_TEMPLATE_KEY };

export type ConversationAnalysisForDisplay = {
	summary: string | null;
	keyTakeaways: Array<{
		priority: "high" | "medium" | "low";
		summary: string;
		evidenceSnippets: string[];
		/** Matched evidence ID for cross-column linking (populated post-parse) */
		evidenceId?: string;
	}>;
	openQuestions: string[];
	recommendations: Array<{
		focusArea: string;
		action: string;
		rationale: string;
	}>;
	status: "pending" | "processing" | "completed" | "failed";
	updatedAt: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === "string" ? item.trim() : null))
		.filter((item): item is string => Boolean(item && item.length > 0));
}

function parseKeyTakeaways(raw: unknown): ConversationAnalysisForDisplay["keyTakeaways"] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((item) => {
			if (!item || typeof item !== "object") return null;
			const entry = item as { [key: string]: unknown };
			const summary = typeof entry.summary === "string" ? entry.summary.trim() : "";
			if (!summary) return null;
			const priority =
				entry.priority === "high" || entry.priority === "medium" || entry.priority === "low"
					? entry.priority
					: "medium";
			const evidenceSnippets = parseStringArray(entry.evidence_snippets);
			return { priority, summary, evidenceSnippets };
		})
		.filter(
			(
				item
			): item is {
				priority: "high" | "medium" | "low";
				summary: string;
				evidenceSnippets: string[];
			} => item !== null
		);
}

function parseRecommendations(raw: unknown): ConversationAnalysisForDisplay["recommendations"] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((item) => {
			if (!item || typeof item !== "object") return null;
			const entry = item as { [key: string]: unknown };
			const focusArea = typeof entry.focus_area === "string" ? entry.focus_area.trim() : "";
			const action = typeof entry.action === "string" ? entry.action.trim() : "";
			const rationale = typeof entry.rationale === "string" ? entry.rationale.trim() : "";
			if (!focusArea && !action && !rationale) return null;
			return { focusArea, action, rationale };
		})
		.filter(
			(
				item
			): item is {
				focusArea: string;
				action: string;
				rationale: string;
			} => item !== null
		);
}

// ---------------------------------------------------------------------------
// Primary: Parse from conversation_lens_analyses (conversation-overview lens)
// ---------------------------------------------------------------------------

export function parseConversationOverviewLens(
	analysisData: ConversationOverviewAnalysisData | Record<string, unknown> | null | undefined,
	processedAt: string | null
): ConversationAnalysisForDisplay | null {
	if (!analysisData || typeof analysisData !== "object") return null;

	const data = analysisData as Record<string, unknown>;

	return {
		summary: typeof data.overview === "string" ? data.overview : null,
		keyTakeaways: parseKeyTakeaways(data.key_takeaways),
		openQuestions: parseStringArray(data.open_questions),
		recommendations: parseRecommendations(data.recommended_next_steps),
		status: "completed" as const,
		updatedAt: processedAt,
	};
}

// ---------------------------------------------------------------------------
// Fallback: Parse from legacy interviews.conversation_analysis JSONB
// ---------------------------------------------------------------------------

export function parseConversationAnalysisLegacy(
	raw: Record<string, unknown> | null | undefined,
	updatedAt: string | null
): ConversationAnalysisForDisplay | null {
	if (!raw || typeof raw !== "object") return null;

	return {
		summary: typeof raw.overview === "string" ? raw.overview : null,
		keyTakeaways: parseKeyTakeaways(raw.key_takeaways),
		openQuestions: parseStringArray(raw.open_questions),
		recommendations: parseRecommendations(raw.recommended_next_steps),
		status: "completed" as const,
		updatedAt,
	};
}
