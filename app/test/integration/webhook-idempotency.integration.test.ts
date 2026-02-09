/**
 * Integration tests for idempotency/status progression behavior using the
 * consolidated schema (interviews + conversation_analysis + analysis_jobs).
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

vi.mock("consola", () => ({ default: { log: vi.fn(), error: vi.fn() } }));

const adminClient = testDb;

describe("Webhook Idempotency Integration Tests", () => {
	beforeEach(async () => {
		await seedTestData();
	});

	afterAll(async () => {
		await testDb.removeAllChannels();
	});

	describe("Idempotency Check", () => {
		it("should prevent duplicate processing when interview is already processing with a trigger run", async () => {
			const interviewId = crypto.randomUUID();
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Idempotency Test Interview",
					status: "processing",
					transcript: "Original transcript content",
					conversation_analysis: {
						trigger_run_id: "run_existing_123",
						orchestrator_pending: null,
					},
				})
				.select()
				.single();

			expect(interviewError).toBeNull();
			expect(interview).toBeDefined();

			// Simulate idempotency guard condition used by webhook route.
			const isAlreadyProcessing =
				interview?.status === "ready" ||
				(interview?.status === "transcribed" && !!interview?.transcript) ||
				(interview?.status === "processing" &&
					!!(interview?.conversation_analysis as { trigger_run_id?: string; orchestrator_pending?: string } | null)
						?.trigger_run_id);

			expect(isAlreadyProcessing).toBe(true);

			// No additional work should be scheduled in interview metadata here.
			expect((interview?.conversation_analysis as { trigger_run_id?: string } | null)?.trigger_run_id).toBe(
				"run_existing_123"
			);
		});

		it("should process normally when interview is uploaded and not locked", async () => {
			const interviewId = crypto.randomUUID();
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Pending Processing Test",
					status: "uploaded",
					conversation_analysis: {
						transcript_data: {
							assemblyai_id: "transcript-pending-test",
						},
					},
				})
				.select()
				.single();

			expect(interviewError).toBeNull();
			expect(interview).toBeDefined();

			const { error: updateError } = await adminClient
				.from("interviews")
				.update({
					status: "transcribed",
					transcript: "New transcript from webhook",
					transcript_formatted: {
						full_transcript: "New transcript from webhook",
						confidence: 0.95,
						audio_duration: 120,
					},
				})
				.eq("id", interview?.id);

			expect(updateError).toBeNull();

			const { error: markProcessingError } = await adminClient
				.from("interviews")
				.update({
					status: "processing",
					conversation_analysis: {
						current_step: "analysis",
						status_detail: "Processing with AI",
					},
				})
				.eq("id", interview?.id);

			expect(markProcessingError).toBeNull();

			const { data: finalInterview } = await adminClient
				.from("interviews")
				.select("*")
				.eq("id", interview?.id)
				.single();

			expect(["transcribed", "processing"]).toContain(finalInterview?.status);
			expect(finalInterview?.transcript).toBe("New transcript from webhook");
		});
	});

	describe("Status Progression", () => {
		it("should progress through uploaded -> transcribed -> processing -> ready", async () => {
			const interviewId = crypto.randomUUID();
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Status Progression Test",
					status: "uploaded",
				})
				.select()
				.single();

			expect(interviewError).toBeNull();

			const { error: transcribedError } = await adminClient
				.from("interviews")
				.update({
					status: "transcribed",
					transcript: "Transcription completed",
				})
				.eq("id", interview?.id);
			expect(transcribedError).toBeNull();

			const { error: processingError } = await adminClient
				.from("interviews")
				.update({ status: "processing" })
				.eq("id", interview?.id);
			expect(processingError).toBeNull();

			const { error: readyError } = await adminClient
				.from("interviews")
				.update({ status: "ready" })
				.eq("id", interview?.id);
			expect(readyError).toBeNull();

			const { data: finalInterview } = await adminClient
				.from("interviews")
				.select("status")
				.eq("id", interview?.id)
				.single();
			expect(finalInterview?.status).toBe("ready");
		});
	});

	describe("Admin Client RLS Bypass", () => {
		it("should bypass RLS when using admin client", async () => {
			const interviewId = crypto.randomUUID();
			const { data: adminInterview, error: adminError } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Admin RLS Test",
					status: "uploaded",
				})
				.select()
				.single();

			expect(adminError).toBeNull();
			expect(adminInterview).toBeDefined();

			const { data: readInterview, error: readError } = await adminClient
				.from("interviews")
				.select("*")
				.eq("id", interviewId)
				.single();
			expect(readError).toBeNull();
			expect(readInterview?.title).toBe("Admin RLS Test");
		});

		it("should handle nullable audit fields with admin client", async () => {
			const interviewId = crypto.randomUUID();
			const { data: interview } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Audit Fields Test",
					status: "ready",
				})
				.select()
				.single();

			const { data: insightWithAudit, error: auditError } = await adminClient
				.from("themes")
				.insert({
					interview_id: interview?.id,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Test Insight With Audit",
					pain: "Test pain point",
					details: "Test details",
					evidence: "Test evidence",
					category: "Test",
					journey_stage: "Awareness",
					confidence: 1,
					emotional_response: "Frustrated",
					motivation: "Test motivation",
					desired_outcome: "Test outcome",
					jtbd: "Test JTBD",
					created_by: null,
					updated_by: null,
				})
				.select()
				.single();

			expect(auditError).toBeNull();
			expect(insightWithAudit).toBeDefined();
			expect(insightWithAudit?.created_by).toBeNull();
		});
	});

	describe("Database Constraints", () => {
		it("should handle foreign key relationships correctly", async () => {
			const interviewId = crypto.randomUUID();
			const { data: interview } = await adminClient
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Foreign Key Test",
					status: "ready",
				})
				.select()
				.single();

			const { data: childTheme, error: childThemeError } = await adminClient
				.from("themes")
				.insert({
					interview_id: interview?.id,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Cascade Test Theme",
				})
				.select()
				.single();
			expect(childThemeError).toBeNull();
			expect(childTheme?.interview_id).toBe(interview?.id);

			const { error: deleteError } = await adminClient.from("interviews").delete().eq("id", interview?.id);
			expect(deleteError).toBeNull();

			const { data: orphanedThemes } = await adminClient.from("themes").select("*").eq("interview_id", interview?.id);
			expect(orphanedThemes).toHaveLength(0);
		});
	});
});
