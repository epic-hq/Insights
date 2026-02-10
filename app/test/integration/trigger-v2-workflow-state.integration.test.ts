/**
 * Integration tests for the Trigger.dev v2 workflow state management.
 *
 * Tests the DB-backed state machine that tracks interview processing progress.
 * This is the most failure-prone part of the pipeline — state corruption,
 * lost progress, and stale reads cause interviews to get stuck.
 *
 * Tests hit the real staging Supabase DB (configured via TEST_SUPABASE_* env vars).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
// ---------------------------------------------------------------------------
// State management functions under test (imported from v2 pipeline)
// ---------------------------------------------------------------------------
import {
	initializeWorkflowState,
	loadWorkflowState,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "../../../src/trigger/interview/v2/state";
import {
	cleanupTestData,
	seedTestData,
	TEST_ACCOUNT_ID,
	TEST_INTERVIEW_1_ID,
	TEST_INTERVIEW_3_ID,
	TEST_PROJECT_ID,
	testDb,
} from "../utils/testDb";

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeAll(async () => {
	await seedTestData();
});

afterAll(async () => {
	await cleanupTestData();
});

// Cast testDb to the type expected by state.ts (two different Database type defs exist)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = testDb as any;

// Helper to clear conversation_analysis for a specific interview
async function clearConversationAnalysis(interviewId: string) {
	await db.from("interviews").update({ conversation_analysis: null }).eq("id", interviewId);
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe("Trigger.dev v2 — Workflow State Management", () => {
	describe("initializeWorkflowState", () => {
		it("should create initial state with empty completedSteps", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			const state = await initializeWorkflowState(db, TEST_INTERVIEW_1_ID, TEST_INTERVIEW_1_ID);

			expect(state.interviewId).toBe(TEST_INTERVIEW_1_ID);
			expect(state.completedSteps).toEqual([]);
			expect(state.currentStep).toBe("upload");
			expect(state.lastUpdated).toBeDefined();
		});

		it("should persist state to conversation_analysis JSONB", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			await initializeWorkflowState(db, TEST_INTERVIEW_1_ID, TEST_INTERVIEW_1_ID);

			// Read it back directly from DB
			const { data } = await db
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", TEST_INTERVIEW_1_ID)
				.single();

			const ca = data!.conversation_analysis as Record<string, unknown>;
			expect(ca).toBeDefined();
			expect(ca.workflow_state).toBeDefined();
			expect(ca.completed_steps).toEqual([]);
			expect(ca.current_step).toBe("upload");
		});
	});

	describe("saveWorkflowState + loadWorkflowState round-trip", () => {
		it("should save and load workflow state correctly", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			// Initialize
			await initializeWorkflowState(db, TEST_INTERVIEW_1_ID, TEST_INTERVIEW_1_ID);

			// Save with progress
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				interviewId: TEST_INTERVIEW_1_ID,
				completedSteps: ["upload", "evidence"],
				currentStep: "evidence",
				fullTranscript: "This is a test transcript for the interview.",
				language: "en",
				evidenceIds: ["ev-1", "ev-2", "ev-3"],
			});

			// Load it back
			const loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);

			expect(loaded).not.toBeNull();
			expect(loaded!.interviewId).toBe(TEST_INTERVIEW_1_ID);
			expect(loaded!.completedSteps).toContain("upload");
			expect(loaded!.completedSteps).toContain("evidence");
			expect(loaded!.currentStep).toBe("evidence");
			expect(loaded!.fullTranscript).toBe("This is a test transcript for the interview.");
			expect(loaded!.language).toBe("en");
			expect(loaded!.evidenceIds).toEqual(["ev-1", "ev-2", "ev-3"]);
		});

		it("should merge partial state updates without losing existing fields", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			// Initialize and save initial state
			await initializeWorkflowState(db, TEST_INTERVIEW_1_ID, TEST_INTERVIEW_1_ID);

			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				interviewId: TEST_INTERVIEW_1_ID,
				completedSteps: ["upload"],
				currentStep: "upload",
				fullTranscript: "Original transcript text.",
				language: "en",
			});

			// Partial update — add evidence data, DON'T re-send transcript
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				completedSteps: ["upload", "evidence"],
				currentStep: "evidence",
				evidenceIds: ["ev-1"],
			});

			// Load and verify transcript was preserved
			const loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);

			expect(loaded).not.toBeNull();
			expect(loaded!.fullTranscript).toBe("Original transcript text.");
			expect(loaded!.language).toBe("en");
			expect(loaded!.completedSteps).toContain("evidence");
			expect(loaded!.evidenceIds).toEqual(["ev-1"]);
		});

		it("should return null for interview with no conversation_analysis", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			const loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);
			expect(loaded).toBeNull();
		});
	});

	describe("updateAnalysisJobProgress", () => {
		it("should update progress in conversation_analysis JSONB", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_3_ID);

			// Initialize first
			await initializeWorkflowState(db, TEST_INTERVIEW_3_ID, TEST_INTERVIEW_3_ID);

			// Update progress
			await updateAnalysisJobProgress(db, TEST_INTERVIEW_3_ID, {
				currentStep: "evidence",
				progress: 45,
				statusDetail: "Extracting evidence from transcript",
			});

			// Read directly from DB
			const { data } = await db
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", TEST_INTERVIEW_3_ID)
				.single();

			const ca = data!.conversation_analysis as Record<string, unknown>;
			expect(ca.current_step).toBe("evidence");
			expect(ca.progress).toBe(45);
			expect(ca.status_detail).toBe("Extracting evidence from transcript");
		});

		it("should preserve existing conversation_analysis fields when updating progress", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_3_ID);

			// Write initial state with workflow_state
			await initializeWorkflowState(db, TEST_INTERVIEW_3_ID, TEST_INTERVIEW_3_ID);
			await saveWorkflowState(db, TEST_INTERVIEW_3_ID, {
				interviewId: TEST_INTERVIEW_3_ID,
				completedSteps: ["upload"],
				currentStep: "upload",
			});

			// Update progress (should not clobber workflow_state)
			await updateAnalysisJobProgress(db, TEST_INTERVIEW_3_ID, {
				currentStep: "evidence",
				progress: 40,
			});

			// Verify workflow_state is still present
			const { data } = await db
				.from("interviews")
				.select("conversation_analysis")
				.eq("id", TEST_INTERVIEW_3_ID)
				.single();

			const ca = data!.conversation_analysis as Record<string, unknown>;
			expect(ca.workflow_state).toBeDefined();
			expect(ca.progress).toBe(40);
		});

		it("should no-op for undefined analysisJobId", async () => {
			// Should not throw
			await updateAnalysisJobProgress(db, undefined, {
				currentStep: "evidence",
				progress: 50,
			});
		});
	});

	describe("updateAnalysisJobError", () => {
		it("should set error state and update interview status to 'error'", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_3_ID);

			// Initialize
			await initializeWorkflowState(db, TEST_INTERVIEW_3_ID, TEST_INTERVIEW_3_ID);

			// Record error
			await updateAnalysisJobError(db, TEST_INTERVIEW_3_ID, {
				currentStep: "evidence",
				error: "BAML extraction failed: timeout after 30s",
			});

			// Read from DB
			const { data } = await db
				.from("interviews")
				.select("status, conversation_analysis")
				.eq("id", TEST_INTERVIEW_3_ID)
				.single();

			expect(data!.status).toBe("error");
			const ca = data!.conversation_analysis as Record<string, unknown>;
			expect(ca.current_step).toBe("evidence");
			expect(ca.last_error).toBe("BAML extraction failed: timeout after 30s");
		});

		it("should no-op for undefined analysisJobId", async () => {
			await updateAnalysisJobError(db, undefined, {
				currentStep: "evidence",
				error: "test error",
			});
		});
	});

	describe("Full workflow lifecycle simulation", () => {
		it("should track state through upload → evidence → insights → finalize", async () => {
			await clearConversationAnalysis(TEST_INTERVIEW_1_ID);

			// Step 1: Initialize
			const initial = await initializeWorkflowState(db, TEST_INTERVIEW_1_ID, TEST_INTERVIEW_1_ID);
			expect(initial.completedSteps).toEqual([]);

			// Step 2: Upload completes
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				interviewId: TEST_INTERVIEW_1_ID,
				completedSteps: ["upload"],
				currentStep: "upload",
				fullTranscript: "Speaker A: The onboarding was painful.",
				language: "en",
				transcriptData: { words: [{ text: "test", start: 0 }] },
			});

			let loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);
			expect(loaded!.completedSteps).toEqual(["upload"]);

			// Step 3: Evidence completes
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				completedSteps: ["upload", "evidence"],
				currentStep: "evidence",
				evidenceIds: ["ev-abc", "ev-def"],
				evidenceUnits: [
					{
						verbatim: "The onboarding was painful",
						gist: "Onboarding pain point",
						kind_tags: ["pain_point"],
						person_key: "speaker-a",
					} as any,
				],
			});

			loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);
			expect(loaded!.completedSteps).toContain("evidence");
			expect(loaded!.evidenceIds).toEqual(["ev-abc", "ev-def"]);
			expect(loaded!.fullTranscript).toBe("Speaker A: The onboarding was painful.");

			// Step 4: Insights completes
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				completedSteps: ["upload", "evidence", "insights"],
				currentStep: "insights",
				insightIds: ["theme-1", "theme-2"],
			});

			loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);
			expect(loaded!.completedSteps).toContain("insights");
			expect(loaded!.insightIds).toEqual(["theme-1", "theme-2"]);
			// Evidence data should still be there
			expect(loaded!.evidenceIds).toEqual(["ev-abc", "ev-def"]);

			// Step 5: Finalize
			await saveWorkflowState(db, TEST_INTERVIEW_1_ID, {
				completedSteps: ["upload", "evidence", "enrich-person", "insights", "personas", "answers", "finalize"],
				currentStep: "complete",
			});

			loaded = await loadWorkflowState(db, TEST_INTERVIEW_1_ID);
			expect(loaded!.completedSteps).toHaveLength(7);
			expect(loaded!.currentStep).toBe("complete");
			// All accumulated data should still be present
			expect(loaded!.fullTranscript).toContain("onboarding was painful");
			expect(loaded!.evidenceIds).toEqual(["ev-abc", "ev-def"]);
			expect(loaded!.insightIds).toEqual(["theme-1", "theme-2"]);
		});
	});

	describe("Finalize interview — status transitions", () => {
		it("should transition interview status from processing to ready", async () => {
			// Set to processing
			await db.from("interviews").update({ status: "processing" }).eq("id", TEST_INTERVIEW_3_ID);

			// Simulate finalize: set status to ready
			const { error } = await db
				.from("interviews")
				.update({
					status: "ready",
					updated_at: new Date().toISOString(),
					conversation_analysis: {
						current_step: "complete",
						progress: 100,
						completed_at: new Date().toISOString(),
						evidence_count: 5,
						status_detail: "Analysis complete",
					},
				})
				.eq("id", TEST_INTERVIEW_3_ID);

			expect(error).toBeNull();

			// Verify
			const { data } = await db
				.from("interviews")
				.select("status, conversation_analysis")
				.eq("id", TEST_INTERVIEW_3_ID)
				.single();

			expect(data!.status).toBe("ready");
			const ca = data!.conversation_analysis as Record<string, unknown>;
			expect(ca.current_step).toBe("complete");
			expect(ca.progress).toBe(100);
			expect(ca.evidence_count).toBe(5);
		});

		it("should transition interview status from processing to error", async () => {
			await db.from("interviews").update({ status: "processing" }).eq("id", TEST_INTERVIEW_3_ID);

			const { error } = await db
				.from("interviews")
				.update({
					status: "error",
					processing_metadata: {
						current_step: "evidence",
						progress: 40,
						failed_at: new Date().toISOString(),
						error: "BAML timeout after 30s",
						trigger_run_id: "run_test_123",
					},
				})
				.eq("id", TEST_INTERVIEW_3_ID);

			expect(error).toBeNull();

			const { data } = await db
				.from("interviews")
				.select("status, processing_metadata")
				.eq("id", TEST_INTERVIEW_3_ID)
				.single();

			expect(data!.status).toBe("error");
			const pm = data!.processing_metadata as Record<string, unknown>;
			expect(pm.error).toBe("BAML timeout after 30s");
			expect(pm.trigger_run_id).toBe("run_test_123");
		});
	});

	describe("Conversation overview lens write during finalize", () => {
		it("should write lens analysis that the detail page can read back", async () => {
			// Seed the conversation-overview template if missing
			const { data: existing } = await db
				.from("conversation_lens_templates")
				.select("template_key")
				.eq("template_key", "conversation-overview")
				.maybeSingle();

			if (!existing) {
				await db.from("conversation_lens_templates").insert({
					template_key: "conversation-overview",
					template_name: "Conversation Overview",
					summary: "AI-generated overview of the conversation",
					category: "system",
					display_order: 1,
					is_active: true,
					is_system: true,
					is_public: true,
					template_definition: { sections: [], entities: [] },
				});
			}

			// Upsert a conversation overview lens analysis
			const analysisData = {
				overview: "Discussion about onboarding friction and pricing concerns.",
				key_takeaways: [
					{
						priority: "high",
						summary: "Onboarding takes too long for enterprise teams",
						evidence_snippets: ["It took us three weeks to get fully set up"],
					},
				],
				open_questions: ["What is the ideal onboarding timeline?"],
				recommended_next_steps: [
					{
						focus_area: "Product",
						action: "Simplify the enterprise setup wizard",
						rationale: "Reduces time-to-value for new customers",
					},
				],
			};

			const { error: upsertError } = await db.from("conversation_lens_analyses").upsert(
				{
					interview_id: TEST_INTERVIEW_1_ID,
					template_key: "conversation-overview",
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					analysis_data: analysisData,
					processed_at: new Date().toISOString(),
				},
				{ onConflict: "interview_id,template_key" }
			);
			expect(upsertError).toBeNull();

			// Read it back the way the detail page does
			const { data: analyses, error: readError } = await db
				.from("conversation_lens_analyses")
				.select("*, conversation_lens_templates!inner(*)")
				.eq("interview_id", TEST_INTERVIEW_1_ID)
				.eq("template_key", "conversation-overview");

			expect(readError).toBeNull();
			expect(analyses).toHaveLength(1);

			const lens = analyses![0];
			const ad = lens.analysis_data as Record<string, unknown>;
			expect(ad.overview).toContain("onboarding friction");
			expect((ad.key_takeaways as any[])[0].priority).toBe("high");
			expect((ad.recommended_next_steps as any[])[0].focus_area).toBe("Product");
		});
	});
});
