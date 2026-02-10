/**
 * Parses raw conversation_analysis JSONB from the database into a
 * typed display structure used by the interview detail page.
 */

export type ConversationAnalysisForDisplay = {
	summary: string | null;
	keyTakeaways: Array<{
		priority: "high" | "medium" | "low";
		summary: string;
		evidenceSnippets: string[];
	}>;
	openQuestions: string[];
	recommendations: Array<{
		focusArea: string;
		action: string;
		rationale: string;
	}>;
	status: "pending" | "processing" | "completed" | "failed";
	updatedAt: string | null;
	customLenses: Record<string, { summary?: string; notes?: string }>;
};

export function parseConversationAnalysis(
	raw: Record<string, unknown> | null | undefined,
	updatedAt: string | null
): ConversationAnalysisForDisplay | null {
	if (!raw || typeof raw !== "object") return null;

	const parseStringArray = (value: unknown): string[] => {
		if (!Array.isArray(value)) return [];
		return value
			.map((item) => (typeof item === "string" ? item.trim() : null))
			.filter((item): item is string => Boolean(item && item.length > 0));
	};

	const parseKeyTakeaways = (): ConversationAnalysisForDisplay["keyTakeaways"] => {
		const value = raw.key_takeaways as unknown;
		if (!Array.isArray(value)) return [];
		return value
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
	};

	const parseRecommendations = (): ConversationAnalysisForDisplay["recommendations"] => {
		const value = raw.recommended_next_steps as unknown;
		if (!Array.isArray(value)) return [];
		return value
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
	};

	const parseCustomLenses = (): ConversationAnalysisForDisplay["customLenses"] => {
		const value = raw.custom_lenses as unknown;
		if (!value || typeof value !== "object") return {};
		const entries = Object.entries(value as Record<string, unknown>).reduce(
			(acc, [key, data]) => {
				if (!data || typeof data !== "object") return acc;
				const entry = data as { [field: string]: unknown };
				const summary = typeof entry.summary === "string" ? entry.summary : undefined;
				const notes = typeof entry.notes === "string" ? entry.notes : undefined;
				acc[key] = {};
				if (summary) acc[key].summary = summary;
				if (notes) acc[key].notes = notes;
				return acc;
			},
			{} as Record<string, { summary?: string; notes?: string }>
		);
		return entries;
	};

	return {
		summary: typeof raw.overview === "string" ? raw.overview : null,
		keyTakeaways: parseKeyTakeaways(),
		openQuestions: parseStringArray(raw.open_questions),
		recommendations: parseRecommendations(),
		status: "completed" as const,
		updatedAt,
		customLenses: parseCustomLenses(),
	};
}
