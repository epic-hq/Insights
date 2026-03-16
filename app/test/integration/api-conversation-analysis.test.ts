/**
 * High-ROI API Integration Tests for conversation_analysis consolidation
 *
 * Tests the actual API route behavior with conversation_analysis:
 * 1. Reprocess Evidence API
 * 2. Reanalyze Themes API
 * 3. Cancel Analysis Run API
 */

import type { ActionFunctionArgs } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { action as CancelAnalysisAction } from "~/routes/api.cancel-analysis-run";
import type { action as ReanalyzeThemesAction } from "~/routes/api.reanalyze-themes";
import type { action as ReprocessEvidenceAction } from "~/routes/api.reprocess-evidence";
import { seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

const { mockTrigger, mockRunsCancel } = vi.hoisted(() => ({
	mockTrigger: vi.fn().mockResolvedValue({ id: "run_test123" }),
	mockRunsCancel: vi.fn().mockResolvedValue({}),
}));

// Mock Supabase server client
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(() => ({ client: testDb })),
	createSupabaseAdminClient: vi.fn(() => testDb),
	getAuthenticatedUser: vi.fn().mockResolvedValue({
		user: { sub: "00000000-0000-0000-0000-00000000f001" },
		headers: new Headers(),
	}),
}));

// Mock Trigger.dev
vi.mock("@trigger.dev/sdk", () => ({
	tasks: {
		trigger: mockTrigger,
	},
	runs: {
		cancel: mockRunsCancel,
	},
}));

// Mock R2
vi.mock("~/utils/r2.server", () => ({
	createR2PresignedUrl: vi.fn().mockReturnValue({
		url: "https://r2.example.com/test.mp3?presigned=true",
	}),
}));

// Mock transcript sanitization
vi.mock("~/utils/transcript/sanitizeTranscriptData.server", () => ({
	safeSanitizeTranscriptPayload: vi.fn((data) => data || {}),
}));

describe("API Routes - Conversation Analysis Consolidation", () => {
	let cancelAnalysisAction: typeof CancelAnalysisAction;
	let reanalyzeThemesAction: typeof ReanalyzeThemesAction;
	let reprocessEvidenceAction: typeof ReprocessEvidenceAction;
	type RouteActionArgs = Parameters<typeof ReprocessEvidenceAction>[0];

	const mockContext = {
		get: vi.fn(),
		set: vi.fn(),
	} as unknown as ActionFunctionArgs["context"];

	function createActionArgs(request: Request): RouteActionArgs {
		return {
			request,
			params: {},
			context: mockContext,
			unstable_pattern: "",
		} as RouteActionArgs;
	}

	function requireId(value: string | undefined, label: string): string {
		if (!value) {
			throw new Error(`Expected ${label} to be defined in test setup`);
		}
		return value;
	}

	function asRecord(value: unknown): Record<string, unknown> | null {
		if (!value || typeof value !== "object" || Array.isArray(value)) {
			return null;
		}
		return value as Record<string, unknown>;
	}

	function asWorkflowState(value: unknown): { interviewId?: string; evidenceIds?: string[] } | null {
		const record = asRecord(value);
		if (!record) return null;
		return {
			interviewId: typeof record.interviewId === "string" ? record.interviewId : undefined,
			evidenceIds: Array.isArray(record.evidenceIds)
				? record.evidenceIds.filter((item): item is string => typeof item === "string")
				: undefined,
		};
	}

	beforeAll(async () => {
		({ action: cancelAnalysisAction } = await import("~/routes/api.cancel-analysis-run"));
		({ action: reanalyzeThemesAction } = await import("~/routes/api.reanalyze-themes"));
		({ action: reprocessEvidenceAction } = await import("~/routes/api.reprocess-evidence"));
	});

	beforeEach(async () => {
		await seedTestData();
		vi.clearAllMocks();
	});

	afterAll(async () => {
		await testDb.removeAllChannels();
	});

	describe("api.reprocess-evidence", () => {
		it("should reprocess evidence using conversation_analysis", async () => {
			// Create interview with transcript
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Reprocess Test",
					status: "ready",
					media_url: "test-key",
					transcript_formatted: {
						full_transcript: "test transcript content",
						speaker_transcripts: [{ speaker: "A", text: "Hello", start: 0, end: 1 }],
					},
					conversation_analysis: {
						custom_instructions: "Test instructions",
					},
				})
				.select()
				.single();

			const formData = new FormData();
			const interviewId = requireId(interview?.id, "interview.id");
			formData.append("interview_id", interviewId);

			const request = new Request("http://localhost/api/reprocess-evidence", {
				method: "POST",
				body: formData,
			});

			const response = await reprocessEvidenceAction(createActionArgs(request));
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.runId).toBe("run_test123");

			// Verify conversation_analysis was updated
			const { data: updated } = await testDb
				.from("interviews")
				.select("status, conversation_analysis")
				.eq("id", interviewId)
				.single();

			expect(updated?.status).toBe("processing");
			const analysis = asRecord(updated?.conversation_analysis);
			expect(analysis?.status_detail).toBeDefined();
			expect(analysis?.trigger_run_id).toBe("run_test123");

			// Verify Trigger.dev was called with correct payload
			expect(mockTrigger).toHaveBeenCalledWith(
				expect.stringContaining("orchestrator"),
				expect.objectContaining({
					analysisJobId: interviewId,
					existingInterviewId: interviewId,
					resumeFrom: "evidence",
				})
			);
		});

		it("should fail when interview has no transcript", async () => {
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "No Transcript",
					status: "draft",
				})
				.select()
				.single();

			const formData = new FormData();
			formData.append("interview_id", requireId(interview?.id, "interview.id"));

			const request = new Request("http://localhost/api/reprocess-evidence", {
				method: "POST",
				body: formData,
			});

			const response = await reprocessEvidenceAction(createActionArgs(request));
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toContain("No transcript available");
		});
	});

	describe("api.reanalyze-themes", () => {
		it("should reanalyze themes using conversation_analysis and workflow_state", async () => {
			// Create interview with evidence
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Reanalyze Test",
					status: "ready",
					media_url: "test-key",
					transcript_formatted: {
						full_transcript: "test transcript",
					},
					conversation_analysis: {
						custom_instructions: "Theme analysis instructions",
					},
				})
				.select()
				.single();

			// Create evidence for the interview
			const { data: evidence } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: interview?.id,
					verbatim: "This is test evidence",
					gist: "Test evidence",
					chunk: "Test context",
				})
				.select()
				.single();

			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Theme",
					lastname: "Tester",
				})
				.select("id")
				.single();

			const interviewId = requireId(interview?.id, "interview.id");
			const evidenceId = requireId(evidence?.id, "evidence.id");
			const personId = requireId(person?.id, "person.id");

			await testDb.from("interview_people").insert({
				interview_id: interviewId,
				person_id: personId,
				project_id: TEST_PROJECT_ID,
				role: "participant",
			});

			const formData = new FormData();
			formData.append("interview_id", interviewId);

			const request = new Request("http://localhost/api/reanalyze-themes", {
				method: "POST",
				body: formData,
			});

			const response = await reanalyzeThemesAction(createActionArgs(request));
			const result = await response.json();

			expect(result.success).toBe(true);
			expect(result.runId).toBe("run_test123");

			// Verify conversation_analysis was updated
			const { data: updated } = await testDb
				.from("interviews")
				.select("status, conversation_analysis")
				.eq("id", interviewId)
				.single();

			expect(updated?.status).toBe("processing");
			const analysis = asRecord(updated?.conversation_analysis);
			expect(analysis?.status_detail).toBeDefined();
			expect(analysis?.trigger_run_id).toBe("run_test123");

			// Verify workflow_state was stored
			const workflowState = asWorkflowState(analysis?.workflow_state);
			if (workflowState) {
				expect(workflowState.interviewId).toBe(interviewId);
				expect(workflowState.evidenceIds).toContain(evidenceId);
			}
		});

		it("should fail when interview has no evidence", async () => {
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "No Evidence",
					status: "ready",
					transcript_formatted: {
						full_transcript: "test transcript",
					},
				})
				.select()
				.single();

			const formData = new FormData();
			formData.append("interview_id", requireId(interview?.id, "interview.id"));

			const request = new Request("http://localhost/api/reanalyze-themes", {
				method: "POST",
				body: formData,
			});

			const response = await reanalyzeThemesAction(createActionArgs(request));
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toContain("No evidence found");
		});

		it("should preserve custom_instructions from conversation_analysis", async () => {
			const customInstructions = "Focus on pain points and workflows";

			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Custom Instructions Test",
					status: "ready",
					transcript_formatted: {
						full_transcript: "test transcript",
					},
					conversation_analysis: {
						custom_instructions: customInstructions,
					},
				})
				.select()
				.single();

			// Create evidence
			const interviewId = requireId(interview?.id, "interview.id");

			await testDb.from("evidence").insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				interview_id: interviewId,
				verbatim: "Test evidence",
				gist: "Test",
			});

			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Instruction",
					lastname: "Tester",
				})
				.select("id")
				.single();

			const personId = requireId(person?.id, "person.id");

			await testDb.from("interview_people").insert({
				interview_id: interviewId,
				person_id: personId,
				project_id: TEST_PROJECT_ID,
				role: "participant",
			});

			const formData = new FormData();
			formData.append("interview_id", interviewId);

			const request = new Request("http://localhost/api/reanalyze-themes", {
				method: "POST",
				body: formData,
			});

			await reanalyzeThemesAction(createActionArgs(request));

			// Verify custom instructions were preserved and passed to trigger
			expect(mockTrigger).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					userCustomInstructions: customInstructions,
				})
			);

			const { data: updated } = await testDb
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", interviewId)
				.single();

			const analysis = asRecord(updated?.conversation_analysis);
			expect(analysis?.custom_instructions).toBe(customInstructions);
		});
	});

	describe("api.cancel-analysis-run", () => {
		it("should cancel run and update conversation_analysis", async () => {
			const triggerRunId = "run_to_cancel_123";

			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Cancel Test",
					status: "processing",
					conversation_analysis: {
						trigger_run_id: triggerRunId,
						current_step: "evidence",
						status_detail: "Extracting evidence",
						progress: 50,
					},
				})
				.select()
				.single();

			const formData = new FormData();
			formData.append("runId", triggerRunId);
			const interviewId = requireId(interview?.id, "interview.id");
			formData.append("analysisJobId", interviewId);

			const request = new Request("http://localhost/api/cancel-analysis-run", {
				method: "POST",
				body: formData,
			});

			const response = await cancelAnalysisAction(createActionArgs(request));
			const result = await response.json();

			expect(result.success).toBe(true);

			// Verify interview was updated
			const { data: canceled } = await testDb
				.from("interviews")
				.select("status, conversation_analysis")
				.eq("id", interviewId)
				.single();

			expect(canceled?.status).toBe("error");
			const analysis = asRecord(canceled?.conversation_analysis);
			expect(["Canceled by user", "Interview processing failed"]).toContain(analysis?.status_detail);
			expect(["Analysis canceled by user", "Interview processing failed"]).toContain(analysis?.last_error);
			expect(analysis?.canceled_at).toBeDefined();
			expect(analysis?.trigger_run_id).toBe(triggerRunId); // Preserved
		});

		it("should fail when run ID doesn't match conversation_analysis", async () => {
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Mismatch Test",
					status: "processing",
					conversation_analysis: {
						trigger_run_id: "run_correct_123",
					},
				})
				.select()
				.single();

			const formData = new FormData();
			formData.append("runId", "run_wrong_456");
			formData.append("analysisJobId", requireId(interview?.id, "interview.id"));

			const request = new Request("http://localhost/api/cancel-analysis-run", {
				method: "POST",
				body: formData,
			});

			const response = await cancelAnalysisAction(createActionArgs(request));
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toContain("Run ID mismatch");
		});

		it("should fail when interview is not in cancellable state", async () => {
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Not Cancellable",
					status: "ready", // Not cancellable
					conversation_analysis: {
						trigger_run_id: "run_complete_123",
					},
				})
				.select()
				.single();

			const formData = new FormData();
			formData.append("runId", "run_complete_123");
			formData.append("analysisJobId", requireId(interview?.id, "interview.id"));

			const request = new Request("http://localhost/api/cancel-analysis-run", {
				method: "POST",
				body: formData,
			});

			const response = await cancelAnalysisAction(createActionArgs(request));
			const result = await response.json();

			expect(response.status).toBe(400);
			expect(result.error).toContain("not in a cancellable state");
		});
	});

	describe("Environment-based Workflow Selection", () => {
		it("should use v2 orchestrator when ENABLE_MODULAR_WORKFLOW=true", async () => {
			const originalEnv = process.env.ENABLE_MODULAR_WORKFLOW;
			process.env.ENABLE_MODULAR_WORKFLOW = "true";

			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "V2 Workflow Test",
					status: "ready",
					media_url: "test-key",
					transcript_formatted: {
						full_transcript: "test transcript",
						speaker_transcripts: [],
					},
				})
				.select()
				.single();

			const formData = new FormData();
			const interviewId = requireId(interview?.id, "interview.id");
			formData.append("interview_id", interviewId);

			const request = new Request("http://localhost/api/reprocess-evidence", {
				method: "POST",
				body: formData,
			});

			await reprocessEvidenceAction(createActionArgs(request));

			// Verify v2 orchestrator was called
			expect(mockTrigger).toHaveBeenCalledWith(
				"interview.v2.orchestrator",
				expect.objectContaining({
					analysisJobId: interviewId,
					resumeFrom: "evidence",
				})
			);

			process.env.ENABLE_MODULAR_WORKFLOW = originalEnv;
		});
	});
});
