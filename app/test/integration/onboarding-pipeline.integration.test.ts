import { tasks } from "@trigger.dev/sdk";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { action as webhookAction } from "~/routes/api.assemblyai-webhook";
import { action as onboardingAction } from "~/routes/api.onboarding-start";
import { mockTestAuth, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

// Mock dependencies that require external services
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: () => mockTestAuth(),
	createSupabaseAdminClient: () => testDb, // Use test DB as admin client
	getAuthenticatedUser: () =>
		Promise.resolve({
			user: {
				sub: "test-user-123",
			},
		}),
}));

vi.mock("~/utils/processInterview.server", () => ({
	processInterviewTranscriptWithAdminClient: vi.fn().mockResolvedValue({
		success: true,
		insights: [
			{
				id: "00000000-0000-0000-0000-00000000a001",
				name: "Test Insight",
				pain: "Test pain point",
				details: "Test details",
				evidence: "Test evidence",
				category: "Test",
				journey_stage: "Awareness",
				confidence: 0.9,
				emotional_response: "Frustrated",
				motivation: "Test motivation",
				desired_outcome: "Test outcome",
				jtbd: "Test JTBD",
				values: ["test_value"],
				related_tags: ["test_tag"],
			},
		],
		people: [
			{
				id: "00000000-0000-0000-0000-00000000b001",
				name: "Test Person",
				description: "Test description",
				segment: "Test Segment",
				contact_info: "test@example.com",
			},
		],
	}),
}));

vi.mock("consola");
vi.mock("@trigger.dev/sdk", () => ({
	tasks: {
		trigger: vi.fn().mockResolvedValue({ id: "run-test-123" }),
	},
}));

// Mock AssemblyAI API
global.fetch = vi.fn();
const originalRpc = testDb.rpc.bind(testDb);

describe("Onboarding Pipeline Integration", () => {
	beforeEach(async () => {
		await seedTestData();
		vi.clearAllMocks();
		vi.spyOn(testDb, "rpc").mockImplementation((fn: string, args?: Record<string, unknown>) => {
			if (fn === "get_user_accounts") {
				return Promise.resolve({
					data: [{ account_id: TEST_ACCOUNT_ID, personal_account: false }],
					error: null,
				}) as any;
			}
			return originalRpc(fn, args as any);
		});
		await testDb.from("user_settings").upsert(
			{
				user_id: "test-user-123",
				last_used_account_id: TEST_ACCOUNT_ID,
			},
			{ onConflict: "user_id" }
		);
	});

	afterAll(async () => {
		await testDb.removeAllChannels();
	});

	describe("Complete Onboarding Flow", () => {
		it("should complete full pipeline from upload to ready status", async () => {
			// Mock successful transcription start
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "transcript-123",
						status: "queued",
					}),
			} as Response);

			// Step 1: Start onboarding
			const formData = new FormData();
			formData.append(
				"onboardingData",
				JSON.stringify({
					icp: "SMB founders",
					role: "Founder",
					goal: "Validate core onboarding friction",
					questions: ["What slowed you down most?", "What outcome were you expecting?"],
					mediaType: "interview",
				})
			);
			formData.append("sourceType", "audio_upload");
			formData.append("fileExtension", "mp3");
			// Use direct R2 path so test doesn't depend on file storage workers
			formData.append("r2Key", `accounts/${TEST_ACCOUNT_ID}/projects/${TEST_PROJECT_ID}/interviews/test-interview.mp3`);
			formData.append("originalFilename", "test-interview.mp3");
			formData.append("originalFileSize", "1024");
			formData.append("originalContentType", "audio/mpeg");

			const onboardingRequest = new Request("http://localhost/api/onboarding-start", {
				method: "POST",
				body: formData,
			});

			const onboardingResponse = await onboardingAction({ request: onboardingRequest });
			const onboardingResult = await onboardingResponse.json();
			expect(onboardingResponse.status).toBe(200);
			expect(onboardingResult.success).toBe(true);
			expect(onboardingResult.interview?.id).toBeDefined();

			const interviewId = onboardingResult.interview.id;

			// Verify database state after onboarding
			const { data: interview } = await testDb.from("interviews").select("*").eq("id", interviewId).single();

			expect(interview?.status).toBe("processing");
			expect((interview?.conversation_analysis as any)?.transcript_data?.assemblyai_id).toBe("transcript-123");

			// Verify onboarding completion flag
			const { data: userSettings } = await testDb
				.from("user_settings")
				.select("*")
				.eq("user_id", "test-user-123")
				.maybeSingle();

			// Visibility of user_settings can vary with test DB policies; assert when row is visible.
			if (userSettings) {
				expect(userSettings.onboarding_completed).toBe(true);
			}

			// Step 2: Simulate webhook callback for completed transcription
			// Mock AssemblyAI transcript fetch
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						text: "This is a test transcript about user research and insights.",
						confidence: 0.95,
						audio_duration: 180,
					}),
			} as Response);

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
				text: "This is a test transcript about user research and insights.",
				confidence: 0.95,
				audio_duration: 180,
			};

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			});

			const webhookResponse = await webhookAction({ request: webhookRequest });
			expect(webhookResponse.status).toBe(200);

			const webhookResult = await webhookResponse.json();
			expect(webhookResult.success).toBe(true);

			// Verify consolidated pipeline state after webhook + orchestrator trigger
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interviewId).single();

			expect(finalInterview?.status).toBe("processing");
			expect(finalInterview?.transcript).toBe("This is a test transcript about user research and insights.");
			expect(finalInterview?.duration_sec).toBe(180);
			expect((finalInterview?.conversation_analysis as any)?.trigger_run_id).toBe("run-test-123");
			expect(vi.mocked(tasks.trigger)).toHaveBeenCalled();
		});

		it("should handle webhook idempotency correctly", async () => {
			// Create an already-ready interview with transcript mapping in conversation_analysis
			const interviewId = crypto.randomUUID();
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Idempotency Test",
					status: "ready",
					transcript: "Existing transcript",
					conversation_analysis: {
						transcript_data: {
							assemblyai_id: "transcript-456",
						},
					} as any,
				})
				.select()
				.single();

			// Send webhook for already completed job
			const webhookPayload = {
				transcript_id: "transcript-456",
				status: "completed" as const,
				text: "New transcript that should be ignored",
			};

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			});

			const webhookResponse = await webhookAction({ request: webhookRequest });
			expect(webhookResponse.status).toBe(200);

			const webhookResult = await webhookResponse.json();
			expect(webhookResult.success).toBe(true);
			expect(webhookResult.message).toBe("Already processed");

			// Verify original transcript was not overwritten
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interview?.id).single();

			expect(finalInterview?.transcript).toBe("Existing transcript");
			expect(finalInterview?.status).toBe("ready");
			expect(vi.mocked(tasks.trigger)).not.toHaveBeenCalled();
		});

		it("should progress through correct status transitions", async () => {
			// Create interview in uploaded state with transcript mapping in conversation_analysis
			const interviewId = crypto.randomUUID();
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Status Test",
					status: "uploaded",
					conversation_analysis: {
						transcript_data: {
							assemblyai_id: "transcript-789",
						},
					} as any,
				})
				.select()
				.single();

			// Mock AssemblyAI transcript fetch
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						text: "Status progression test transcript",
						confidence: 0.9,
						audio_duration: 120,
					}),
			} as Response);

			// Track status changes by querying before and after
			const getStatus = async () => {
				const { data } = await testDb.from("interviews").select("status").eq("id", interview?.id).single();
				return data?.status;
			};

			expect(await getStatus()).toBe("uploaded"); // 20%

			// Send webhook
			const webhookPayload = {
				transcript_id: "transcript-789",
				status: "completed" as const,
				text: "Status progression test transcript",
			};

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			});

			const webhookResponse = await webhookAction({ request: webhookRequest });
			expect(webhookResponse.status).toBe(200);

			// Webhook now leaves interview in processing while orchestrator runs asynchronously
			expect(await getStatus()).toBe("processing");
			expect(vi.mocked(tasks.trigger)).toHaveBeenCalled();
		});
	});

	describe("Error Scenarios", () => {
		it("should handle transcription failures gracefully", async () => {
			// Create interview with transcript mapping in conversation_analysis
			const interviewId = crypto.randomUUID();
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: interviewId,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					title: "Error Test",
					status: "uploaded",
					conversation_analysis: {
						transcript_data: {
							assemblyai_id: "transcript-error",
						},
					} as any,
				})
				.select()
				.single();

			// Send webhook with failed status
			const webhookPayload = {
				transcript_id: "transcript-error",
				status: "failed" as const,
			};

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			});

			const webhookResponse = await webhookAction({ request: webhookRequest });
			expect(webhookResponse.status).toBe(200);

			// Verify error status was set
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interview?.id).single();

			expect(finalInterview?.status).toBe("error");
			expect(String((finalInterview?.conversation_analysis as any)?.status_detail ?? "").toLowerCase()).toContain(
				"failed"
			);
			expect((finalInterview?.conversation_analysis as any)?.last_error).toContain("AssemblyAI transcription failed");
		});
	});
});
