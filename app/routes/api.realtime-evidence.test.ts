/**
 * Tests for the realtime evidence extraction API route.
 * Validates input handling, BAML integration, and error cases.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { b } from "~/../baml_client";
import { action } from "./api.realtime-evidence";

vi.mock("~/../baml_client");
vi.mock("consola");

const mockBAML = vi.mocked(b);

function createRequest(body: unknown, method = "POST"): Request {
	return new Request("http://localhost/api/realtime-evidence", {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const MOCK_EXTRACTION_RESULT = {
	evidence: [
		{
			person_key: "participant-1",
			speaker_label: "SPEAKER B",
			gist: "Tool fragmentation causes sync overhead",
			chunk: "Uses Jira, Notion, and spreadsheets that constantly fall out of sync.",
			verbatim: "We lose probably two hours a week just on reconciliation",
			anchors: { start_ms: 5000, end_ms: 12000 },
			facet_mentions: [
				{ person_key: "participant-1", kind_slug: "pain", value: "tool sync overhead" },
				{ person_key: "participant-1", kind_slug: "workflow", value: "manual reconciliation" },
			],
			isQuestion: false,
			pains: ["Losing 2 hours/week on reconciliation"],
			gains: null,
			says: ["We lose probably two hours a week"],
			does: ["Manual sync between Jira, Notion, and spreadsheets"],
			thinks: null,
			feels: null,
			why_it_matters: "Significant productivity loss from fragmented tooling",
		},
	],
	people: [
		{
			person_key: "participant-1",
			person_name: "Speaker B",
			inferred_name: null,
			job_title: "Product Manager",
			job_function: "Product",
			is_interviewer: false,
		},
	],
	scenes: [
		{
			topic: "Tool fragmentation pain points",
			start_evidence_index: 0,
			end_evidence_index: 0,
		},
	],
	interaction_context: "Research",
	context_confidence: 0.9,
	context_reasoning: "Interview-style questions about workflow and tools",
	facet_mentions: [],
};

describe("Realtime Evidence API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("input validation", () => {
		it("should reject non-POST requests", async () => {
			const request = new Request("http://localhost/api/realtime-evidence", {
				method: "GET",
			});

			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(405);

			const data = await response.json();
			expect(data.error).toBe("Method not allowed");
		});

		it("should reject empty utterances", async () => {
			const request = createRequest({ utterances: [], language: "en" });
			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(400);

			const data = await response.json();
			expect(data.error).toBe("No utterances provided");
		});

		it("should reject missing utterances field", async () => {
			const request = createRequest({ language: "en" });
			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(400);
		});
	});

	describe("evidence extraction", () => {
		it("should call BAML with correct parameters", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockResolvedValue(MOCK_EXTRACTION_RESULT as any);

			const utterances = [
				{ speaker: "SPEAKER A", text: "What tools do you use?", start: 0, end: 3000 },
				{ speaker: "SPEAKER B", text: "We use Jira and Notion.", start: 3000, end: 6000 },
			];
			const request = createRequest({ utterances, language: "en" });

			await action({ request, params: {}, context: {} });

			expect(mockBAML.ExtractEvidenceFromTranscriptV2).toHaveBeenCalledTimes(1);
			const [speakerUtterances, chapters, language] = mockBAML.ExtractEvidenceFromTranscriptV2.mock.calls[0];

			// Verify utterance mapping
			expect(speakerUtterances).toHaveLength(2);
			expect(speakerUtterances[0]).toEqual({
				speaker: "SPEAKER A",
				text: "What tools do you use?",
				start: 0,
				end: 3000,
			});

			// Verify empty chapters for realtime
			expect(chapters).toEqual([]);

			// Verify language passthrough
			expect(language).toBe("en");

			expect(mockBAML.ExtractEvidenceFromTranscriptV2.mock.calls[0]).toHaveLength(3);
		});

		it("should handle null start/end timestamps", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockResolvedValue(MOCK_EXTRACTION_RESULT as any);

			const utterances = [{ speaker: "A", text: "Hello" }];
			const request = createRequest({ utterances });

			await action({ request, params: {}, context: {} });

			const [speakerUtterances] = mockBAML.ExtractEvidenceFromTranscriptV2.mock.calls[0];
			expect(speakerUtterances[0].start).toBeNull();
			expect(speakerUtterances[0].end).toBeNull();
		});

		it("should default language to 'en' when not provided", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockResolvedValue(MOCK_EXTRACTION_RESULT as any);

			const request = createRequest({ utterances: [{ speaker: "A", text: "test" }] });
			await action({ request, params: {}, context: {} });

			const [, , language] = mockBAML.ExtractEvidenceFromTranscriptV2.mock.calls[0];
			expect(language).toBe("en");
		});

		it("should return evidence, people, scenes, and context", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockResolvedValue(MOCK_EXTRACTION_RESULT as any);

			const utterances = [{ speaker: "A", text: "test", start: 0, end: 1000 }];
			const request = createRequest({ utterances, language: "en" });

			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.evidence).toHaveLength(1);
			expect(data.evidence[0].gist).toBe("Tool fragmentation causes sync overhead");
			expect(data.evidence[0].facet_mentions).toHaveLength(2);
			expect(data.people).toHaveLength(1);
			expect(data.people[0].job_title).toBe("Product Manager");
			expect(data.scenes).toHaveLength(1);
			expect(data.interactionContext).toBe("Research");
			expect(data.contextConfidence).toBe(0.9);
		});
	});

	describe("error handling", () => {
		it("should return 500 when BAML throws", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockRejectedValue(new Error("LLM rate limited"));

			const utterances = [{ speaker: "A", text: "test" }];
			const request = createRequest({ utterances });

			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(500);

			const data = await response.json();
			expect(data.error).toBe("LLM rate limited");
		});

		it("should handle BAML returning empty arrays", async () => {
			mockBAML.ExtractEvidenceFromTranscriptV2.mockResolvedValue({
				evidence: [],
				people: [],
				scenes: [],
				facet_mentions: [],
				interaction_context: "Research",
				context_confidence: 0.5,
				context_reasoning: "Insufficient data",
			} as any);

			const utterances = [{ speaker: "A", text: "hi" }];
			const request = createRequest({ utterances });

			const response = await action({ request, params: {}, context: {} });
			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.evidence).toEqual([]);
			expect(data.people).toEqual([]);
		});
	});
});
