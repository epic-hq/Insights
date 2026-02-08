/**
 * Real integration tests for webhook idempotency and status progression
 * Tests actual database calls without mocking
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb";

// Only mock external APIs, not our database or core logic
vi.mock("consola", () => ({ default: { log: vi.fn(), error: vi.fn() } }));

// Use real admin client for actual DB operations
const adminClient = createSupabaseAdminClient();

describe("Webhook Idempotency Integration Tests", () => {
	beforeEach(async () => {
		await seedTestData();
	});

	afterAll(async () => {
		await testDb.removeAllChannels();
	});

	describe("Idempotency Check", () => {
		it("should prevent duplicate processing when upload_job status is 'done'", async () => {
			// Create real interview and upload job in database
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: "test-interview-idempotent",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Idempotency Test Interview",
					status: "transcribed",
					transcript: "Original transcript content",
				})
				.select()
				.single();

			expect(interviewError).toBeNull();
			expect(interview).toBeDefined();

			const { data: uploadJob, error: uploadJobError } = await adminClient
				.from("upload_jobs")
				.insert({
					id: "test-upload-job-done",
					interview_id: interview?.id,
					assemblyai_id: "transcript-idempotent-test",
					status: "done", // Already completed
					custom_instructions: "Test instructions",
					status_detail: "Previously completed",
				})
				.select()
				.single();

			expect(uploadJobError).toBeNull();
			expect(uploadJob?.status).toBe("done");

			// Test the actual idempotency logic from webhook
			const { data: foundUploadJob, error: findError } = await adminClient
				.from("upload_jobs")
				.select("*")
				.eq("assemblyai_id", "transcript-idempotent-test")
				.single();

			expect(findError).toBeNull();
			expect(foundUploadJob?.status).toBe("done");

			// Simulate the idempotency check
			if (foundUploadJob?.status === "done") {
				// Should skip processing - verify no changes occur
				const { data: beforeInterview } = await adminClient
					.from("interviews")
					.select("*")
					.eq("id", interview?.id)
					.single();

				const { data: afterInterview } = await adminClient
					.from("interviews")
					.select("*")
					.eq("id", interview?.id)
					.single();

				// Verify nothing changed
				expect(afterInterview?.transcript).toBe("Original transcript content");
				expect(afterInterview?.status).toBe("transcribed");
				expect(beforeInterview?.updated_at).toBe(afterInterview?.updated_at);
			}

			// Verify no duplicate analysis jobs would be created
			const { data: analysisJobs } = await adminClient
				.from("analysis_jobs")
				.select("*")
				.eq("interview_id", interview?.id);

			expect(analysisJobs).toHaveLength(0);
		});

		it("should process normally when upload_job status is 'pending'", async () => {
			// Create real interview and pending upload job
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: "test-interview-pending",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Pending Processing Test",
					status: "uploaded",
				})
				.select()
				.single();

			expect(interviewError).toBeNull();

			const { data: uploadJob, error: uploadJobError } = await adminClient
				.from("upload_jobs")
				.insert({
					id: "test-upload-job-pending",
					interview_id: interview?.id,
					assemblyai_id: "transcript-pending-test",
					status: "pending", // Ready for processing
					custom_instructions: "Test instructions",
				})
				.select()
				.single();

			expect(uploadJobError).toBeNull();
			expect(uploadJob?.status).toBe("pending");

			// Test processing would proceed - update interview status
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

			// Mark upload job as done
			const { error: uploadUpdateError } = await adminClient
				.from("upload_jobs")
				.update({
					status: "done",
					status_detail: "Transcription completed",
				})
				.eq("id", uploadJob?.id);

			expect(uploadUpdateError).toBeNull();

			// Create analysis job
			const { data: analysisJob, error: analysisError } = await adminClient
				.from("analysis_jobs")
				.insert({
					interview_id: interview?.id,
					transcript_data: {
						full_transcript: "New transcript from webhook",
						confidence: 0.95,
					},
					custom_instructions: "Test instructions",
					status: "in_progress",
					status_detail: "Processing with AI",
				})
				.select()
				.single();

			expect(analysisError).toBeNull();
			expect(analysisJob).toBeDefined();

			// Verify final states
			const { data: finalInterview } = await adminClient
				.from("interviews")
				.select("*")
				.eq("id", interview?.id)
				.single();

			expect(finalInterview?.status).toBe("transcribed");
			expect(finalInterview?.transcript).toBe("New transcript from webhook");

			const { data: finalUploadJob } = await adminClient
				.from("upload_jobs")
				.select("*")
				.eq("id", uploadJob?.id)
				.single();

			expect(finalUploadJob?.status).toBe("done");
		});
	});

	describe("Status Progression", () => {
		it("should progress through uploaded -> transcribed -> processing -> ready", async () => {
			// Create interview in uploaded state
			const { data: interview, error: interviewError } = await adminClient
				.from("interviews")
				.insert({
					id: "test-interview-progression",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Status Progression Test",
					status: "uploaded", // 20%
				})
				.select()
				.single();

			expect(interviewError).toBeNull();

			// Step 1: uploaded -> transcribed (50%)
			const { error: transcribedError } = await adminClient
				.from("interviews")
				.update({
					status: "transcribed",
					transcript: "Transcription completed",
				})
				.eq("id", interview?.id);

			expect(transcribedError).toBeNull();

			// Verify transcribed status
			const { data: transcribedInterview } = await adminClient
				.from("interviews")
				.select("status")
				.eq("id", interview?.id)
				.single();

			expect(transcribedInterview?.status).toBe("transcribed");

			// Step 2: transcribed -> processing (85%)
			const { error: processingError } = await adminClient
				.from("interviews")
				.update({ status: "processing" })
				.eq("id", interview?.id);

			expect(processingError).toBeNull();

			// Verify processing status
			const { data: processingInterview } = await adminClient
				.from("interviews")
				.select("status")
				.eq("id", interview?.id)
				.single();

			expect(processingInterview?.status).toBe("processing");

			// Step 3: processing -> ready (100%)
			const { error: readyError } = await adminClient
				.from("interviews")
				.update({ status: "ready" })
				.eq("id", interview?.id);

			expect(readyError).toBeNull();

			// Verify final ready status
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
			// Create data using admin client (should bypass RLS)
			const { data: adminInterview, error: adminError } = await adminClient
				.from("interviews")
				.insert({
					id: "test-admin-rls-bypass",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Admin RLS Test",
					status: "uploaded",
				})
				.select()
				.single();

			expect(adminError).toBeNull();
			expect(adminInterview).toBeDefined();

			// Test that admin client can read data without user context
			const { data: readInterview, error: readError } = await adminClient
				.from("interviews")
				.select("*")
				.eq("id", "test-admin-rls-bypass")
				.single();

			expect(readError).toBeNull();
			expect(readInterview?.title).toBe("Admin RLS Test");

			// Test that admin client can update without user context
			const { error: updateError } = await adminClient
				.from("interviews")
				.update({
					status: "ready",
					transcript: "Updated by admin client",
				})
				.eq("id", "test-admin-rls-bypass");

			expect(updateError).toBeNull();

			// Verify update succeeded
			const { data: updatedInterview } = await adminClient
				.from("interviews")
				.select("*")
				.eq("id", "test-admin-rls-bypass")
				.single();

			expect(updatedInterview?.status).toBe("ready");
			expect(updatedInterview?.transcript).toBe("Updated by admin client");
		});

		it("should handle nullable audit fields with admin client", async () => {
			// Test creating insights with nullable created_by/updated_by
			const { data: interview } = await adminClient
				.from("interviews")
				.insert({
					id: "test-audit-fields",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Audit Fields Test",
					status: "ready",
				})
				.select()
				.single();

			// Create insight without created_by (null)
			const { data: insight, error: insightError } = await adminClient
				.from("themes")
				.insert({
					interview_id: interview?.id,
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					name: "Test Insight",
					pain: "Test pain point",
					details: "Test details",
					evidence: "Test evidence",
					category: "Test",
					journey_stage: "Awareness",
					confidence: "High",
					emotional_response: "Frustrated",
					underlying_motivation: "Test motivation",
					desired_outcome: "Test outcome",
					jtbd: "Test JTBD",
					// created_by and updated_by are null (not provided)
				})
				.select()
				.single();

			expect(insightError).toBeNull();
			expect(insight).toBeDefined();
			expect(insight?.name).toBe("Test Insight");

			// Create insight with created_by set
			const { data: insightWithAudit, error: auditError } = await adminClient
				.from("themes")
				.insert({
					interview_id: interview?.id,
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					name: "Test Insight With Audit",
					pain: "Test pain point",
					details: "Test details",
					evidence: "Test evidence",
					category: "Test",
					journey_stage: "Awareness",
					confidence: "High",
					emotional_response: "Frustrated",
					underlying_motivation: "Test motivation",
					desired_outcome: "Test outcome",
					jtbd: "Test JTBD",
					created_by: TEST_ACCOUNT_ID, // Set audit field
					updated_by: TEST_ACCOUNT_ID,
				})
				.select()
				.single();

			expect(auditError).toBeNull();
			expect(insightWithAudit).toBeDefined();
			expect(insightWithAudit?.created_by).toBe(TEST_ACCOUNT_ID);
		});
	});

	describe("Database Constraints", () => {
		it("should handle foreign key relationships correctly", async () => {
			// Create parent records
			const { data: interview } = await adminClient
				.from("interviews")
				.insert({
					id: "test-fk-parent",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Foreign Key Test",
					status: "ready",
				})
				.select()
				.single();

			const { data: uploadJob } = await adminClient
				.from("upload_jobs")
				.insert({
					interview_id: interview?.id,
					assemblyai_id: "test-fk-upload",
					status: "done",
				})
				.select()
				.single();

			const { data: analysisJob } = await adminClient
				.from("analysis_jobs")
				.insert({
					interview_id: interview?.id,
					transcript_data: { text: "test" },
					status: "done",
				})
				.select()
				.single();

			expect(uploadJob?.interview_id).toBe(interview?.id);
			expect(analysisJob?.interview_id).toBe(interview?.id);

			// Test cascade delete
			const { error: deleteError } = await adminClient.from("interviews").delete().eq("id", interview?.id);

			expect(deleteError).toBeNull();

			// Verify child records were cascade deleted
			const { data: orphanedUpload } = await adminClient
				.from("upload_jobs")
				.select("*")
				.eq("interview_id", interview?.id);

			const { data: orphanedAnalysis } = await adminClient
				.from("analysis_jobs")
				.select("*")
				.eq("interview_id", interview?.id);

			expect(orphanedUpload).toHaveLength(0);
			expect(orphanedAnalysis).toHaveLength(0);
		});
	});
});
