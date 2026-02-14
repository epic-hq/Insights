/**
 * Tests for the conversation-overview lens pipeline:
 * 1. toConversationOverviewAnalysisData transforms BAML output to lens shape
 * 2. parseConversationOverviewLens reads from lens analysis_data
 * 3. parseConversationAnalysisLegacy reads from legacy JSONB (fallback)
 * 4. upsertConversationOverviewLens writes to conversation_lens_analyses
 */

import { describe, expect, it, vi } from "vitest";
import {
	parseConversationAnalysisLegacy,
	parseConversationOverviewLens,
} from "~/features/interviews/lib/parseConversationAnalysis.server";
import type { ConversationAnalysis } from "~/lib/conversation-analyses/schema";
import {
	CONVERSATION_OVERVIEW_TEMPLATE_KEY,
	toConversationOverviewAnalysisData,
} from "~/lib/conversation-analyses/upsertConversationOverviewLens.server";
import { enrichConversationAnalysisWithEvidenceIds } from "~/utils/conversationAnalysis.server";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_BAML_OUTPUT: ConversationAnalysis = {
	overview: "User research interview about onboarding pain points",
	duration_estimate: "45 minutes",
	questions: [
		{
			question: "What's your biggest challenge with onboarding?",
			asked_by: "Interviewer",
			intent: "discover pain points",
			evidence_snippet: "It takes forever to get started",
			confidence: 0.9,
		},
	],
	participant_goals: [
		{
			speaker: "Participant",
			goal: "Reduce onboarding time from 2 weeks to 2 days",
			evidence_snippet: "We lose users in the first week",
			confidence: 0.85,
		},
	],
	key_takeaways: [
		{
			priority: "high",
			summary: "Onboarding takes too long — 2 weeks average",
			evidence_snippets: ["It takes forever to get started", "We lose most users in week one"],
			supporting_evidence_ids: [],
		},
		{
			priority: "medium",
			summary: "Users want self-serve setup",
			evidence_snippets: ["I don't want to wait for a call"],
			supporting_evidence_ids: [],
		},
	],
	open_questions: ["What's the ideal onboarding length?", "Do they need guided vs self-serve?"],
	recommended_next_steps: [
		{
			focus_area: "Onboarding",
			action: "Build a self-serve onboarding wizard",
			rationale: "Users explicitly asked for self-serve and current flow causes 60% drop-off",
		},
	],
};

// ---------------------------------------------------------------------------
// toConversationOverviewAnalysisData
// ---------------------------------------------------------------------------

describe("toConversationOverviewAnalysisData", () => {
	it("transforms BAML output to lens analysis_data shape", () => {
		const result = toConversationOverviewAnalysisData(MOCK_BAML_OUTPUT);

		expect(result.overview).toBe("User research interview about onboarding pain points");
		expect(result.duration_estimate).toBe("45 minutes");
		expect(result.key_takeaways).toHaveLength(2);
		expect(result.key_takeaways[0]).toEqual({
			priority: "high",
			summary: "Onboarding takes too long — 2 weeks average",
			evidence_snippets: ["It takes forever to get started", "We lose most users in week one"],
			supporting_evidence_ids: [],
		});
		expect(result.recommended_next_steps).toHaveLength(1);
		expect(result.recommended_next_steps[0].focus_area).toBe("Onboarding");
		expect(result.open_questions).toHaveLength(2);
		expect(result.questions).toHaveLength(1);
		expect(result.participant_goals).toHaveLength(1);
		expect(result.participant_goals[0].speaker).toBe("Participant");
	});

	it("handles null/optional fields gracefully", () => {
		const minimal: ConversationAnalysis = {
			overview: "Short call",
			questions: [],
			participant_goals: [],
			key_takeaways: [],
			open_questions: [],
			recommended_next_steps: [],
		};
		const result = toConversationOverviewAnalysisData(minimal);

		expect(result.overview).toBe("Short call");
		expect(result.duration_estimate).toBeNull();
		expect(result.key_takeaways).toEqual([]);
		expect(result.recommended_next_steps).toEqual([]);
		expect(result.open_questions).toEqual([]);
	});
});

describe("enrichConversationAnalysisWithEvidenceIds", () => {
	it("links key takeaway snippets to evidence IDs", () => {
		const enriched = enrichConversationAnalysisWithEvidenceIds(MOCK_BAML_OUTPUT, [
			{
				id: "ev-1",
				verbatim: "It takes forever to get started and causes drop-off",
				gist: "Slow onboarding",
			},
			{
				id: "ev-2",
				verbatim: "I don't want to wait for a call",
				gist: "Self-serve setup preference",
			},
		]);

		expect(enriched.key_takeaways[0].supporting_evidence_ids).toEqual(["ev-1"]);
		expect(enriched.key_takeaways[1].supporting_evidence_ids).toEqual(["ev-2"]);
	});

	it("preserves existing supporting IDs when they are valid", () => {
		const withExisting: ConversationAnalysis = {
			...MOCK_BAML_OUTPUT,
			key_takeaways: [
				{
					...MOCK_BAML_OUTPUT.key_takeaways[0],
					supporting_evidence_ids: ["ev-keep"],
				},
			],
		};

		const enriched = enrichConversationAnalysisWithEvidenceIds(withExisting, [
			{ id: "ev-keep", verbatim: "any", gist: null },
			{ id: "ev-other", verbatim: "other", gist: null },
		]);

		expect(enriched.key_takeaways[0].supporting_evidence_ids).toEqual(["ev-keep"]);
	});
});

// ---------------------------------------------------------------------------
// parseConversationOverviewLens (primary read path)
// ---------------------------------------------------------------------------

describe("parseConversationOverviewLens", () => {
	it("parses lens analysis_data into display format", () => {
		const analysisData = toConversationOverviewAnalysisData(MOCK_BAML_OUTPUT);
		const result = parseConversationOverviewLens(analysisData, "2026-02-10T00:00:00Z");

		expect(result).not.toBeNull();
		expect(result!.summary).toBe("User research interview about onboarding pain points");
		expect(result!.keyTakeaways).toHaveLength(2);
		expect(result!.keyTakeaways[0].priority).toBe("high");
		expect(result!.keyTakeaways[0].summary).toBe("Onboarding takes too long — 2 weeks average");
		expect(result!.keyTakeaways[0].evidenceSnippets).toHaveLength(2);
		expect(result!.keyTakeaways[0].supportingEvidenceIds).toEqual([]);
		expect(result!.recommendations).toHaveLength(1);
		expect(result!.recommendations[0].focusArea).toBe("Onboarding");
		expect(result!.recommendations[0].action).toBe("Build a self-serve onboarding wizard");
		expect(result!.openQuestions).toHaveLength(2);
		expect(result!.status).toBe("completed");
		expect(result!.updatedAt).toBe("2026-02-10T00:00:00Z");
	});

	it("returns null for null/undefined input", () => {
		expect(parseConversationOverviewLens(null, null)).toBeNull();
		expect(parseConversationOverviewLens(undefined, null)).toBeNull();
	});

	it("handles missing fields without crashing", () => {
		const partial = { overview: "Just a summary" } as Record<string, unknown>;
		const result = parseConversationOverviewLens(partial, null);

		expect(result).not.toBeNull();
		expect(result!.summary).toBe("Just a summary");
		expect(result!.keyTakeaways).toEqual([]);
		expect(result!.recommendations).toEqual([]);
		expect(result!.openQuestions).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// parseConversationAnalysisLegacy (fallback read path)
// ---------------------------------------------------------------------------

describe("parseConversationAnalysisLegacy", () => {
	it("parses legacy JSONB blob into display format", () => {
		const legacyBlob = {
			overview: "Legacy interview analysis",
			key_takeaways: [{ priority: "high", summary: "Important finding", evidence_snippets: ["quote"] }],
			recommended_next_steps: [{ focus_area: "Product", action: "Ship it", rationale: "Users want it" }],
			open_questions: ["What about pricing?"],
			// Legacy blobs may also have workflow state mixed in
			trigger_run_id: "run_old123",
			current_step: "complete",
		};

		const result = parseConversationAnalysisLegacy(legacyBlob, "2025-12-01T00:00:00Z");

		expect(result).not.toBeNull();
		expect(result!.summary).toBe("Legacy interview analysis");
		expect(result!.keyTakeaways).toHaveLength(1);
		expect(result!.keyTakeaways[0].priority).toBe("high");
		expect(result!.recommendations).toHaveLength(1);
		expect(result!.openQuestions).toEqual(["What about pricing?"]);
		expect(result!.status).toBe("completed");
	});

	it("returns null for null/undefined input", () => {
		expect(parseConversationAnalysisLegacy(null, null)).toBeNull();
		expect(parseConversationAnalysisLegacy(undefined, null)).toBeNull();
	});

	it("handles malformed key_takeaways entries", () => {
		const blob = {
			overview: "test",
			key_takeaways: [
				{ priority: "high", summary: "Good one", evidence_snippets: ["q"] },
				{ priority: "invalid", summary: "" }, // empty summary => filtered out
				null, // null entry => filtered out
				{ summary: "No priority" }, // missing priority => defaults to medium
			],
		};

		const result = parseConversationAnalysisLegacy(blob as any, null);
		expect(result!.keyTakeaways).toHaveLength(2);
		expect(result!.keyTakeaways[0].priority).toBe("high");
		expect(result!.keyTakeaways[1].priority).toBe("medium");
		expect(result!.keyTakeaways[1].summary).toBe("No priority");
	});
});

// ---------------------------------------------------------------------------
// CONVERSATION_OVERVIEW_TEMPLATE_KEY constant
// ---------------------------------------------------------------------------

describe("CONVERSATION_OVERVIEW_TEMPLATE_KEY", () => {
	it("is the expected value", () => {
		expect(CONVERSATION_OVERVIEW_TEMPLATE_KEY).toBe("conversation-overview");
	});
});

// ---------------------------------------------------------------------------
// upsertConversationOverviewLens (write path)
// ---------------------------------------------------------------------------

describe("upsertConversationOverviewLens", () => {
	it("calls db.from('conversation_lens_analyses').upsert with correct shape", async () => {
		const mockUpsert = vi.fn().mockResolvedValue({ error: null });
		const mockTemplateMaybeSingle = vi.fn().mockResolvedValue({
			data: { template_key: "conversation-overview" },
			error: null,
		});
		const mockFrom = vi.fn((table: string) => {
			if (table === "conversation_lens_templates") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							maybeSingle: mockTemplateMaybeSingle,
						}),
					}),
				};
			}
			if (table === "conversation_lens_analyses") {
				return { upsert: mockUpsert };
			}
			return {};
		});
		const mockDb = { from: mockFrom } as any;

		const { upsertConversationOverviewLens } = await import(
			"~/lib/conversation-analyses/upsertConversationOverviewLens.server"
		);

		const result = await upsertConversationOverviewLens({
			db: mockDb,
			interviewId: "int-123",
			accountId: "acc-456",
			projectId: "proj-789",
			analysis: MOCK_BAML_OUTPUT,
			computedBy: "user-abc",
		});

		expect(result.success).toBe(true);
		expect(mockFrom).toHaveBeenCalledWith("conversation_lens_analyses");
		expect(mockUpsert).toHaveBeenCalledTimes(1);

		const [upsertData, upsertOptions] = mockUpsert.mock.calls[0];
		expect(upsertData.interview_id).toBe("int-123");
		expect(upsertData.template_key).toBe("conversation-overview");
		expect(upsertData.account_id).toBe("acc-456");
		expect(upsertData.project_id).toBe("proj-789");
		expect(upsertData.status).toBe("completed");
		expect(upsertData.processed_by).toBe("user-abc");
		expect(upsertData.analysis_data.key_takeaways).toHaveLength(2);
		expect(upsertData.analysis_data.recommended_next_steps).toHaveLength(1);
		expect(upsertOptions).toEqual({ onConflict: "interview_id,template_key" });
	});

	it("returns error when upsert fails", async () => {
		const mockUpsert = vi.fn().mockResolvedValue({
			error: { message: "constraint violation" },
		});
		const mockTemplateMaybeSingle = vi.fn().mockResolvedValue({
			data: { template_key: "conversation-overview" },
			error: null,
		});
		const mockFrom = vi.fn((table: string) => {
			if (table === "conversation_lens_templates") {
				return {
					select: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							maybeSingle: mockTemplateMaybeSingle,
						}),
					}),
				};
			}
			if (table === "conversation_lens_analyses") {
				return { upsert: mockUpsert };
			}
			return {};
		});
		const mockDb = { from: mockFrom } as any;

		const { upsertConversationOverviewLens } = await import(
			"~/lib/conversation-analyses/upsertConversationOverviewLens.server"
		);

		const result = await upsertConversationOverviewLens({
			db: mockDb,
			interviewId: "int-123",
			accountId: "acc-456",
			analysis: MOCK_BAML_OUTPUT,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("constraint violation");
	});
});
