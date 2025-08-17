import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { action as webhookAction } from "~/routes/api.assemblyai-webhook"
import { action as onboardingAction } from "~/routes/api.onboarding-start"
import { getTestDbState, mockTestAuth, seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb"

// Mock dependencies that require external services
vi.mock("~/lib/supabase/server", () => ({
	getServerClient: () => mockTestAuth(),
	createSupabaseAdminClient: () => testDb, // Use test DB as admin client
}))

vi.mock("~/utils/processInterview.server", () => ({
	processInterviewTranscriptWithAdminClient: vi.fn().mockResolvedValue({
		success: true,
		insights: [
			{
				id: "test-insight-1",
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
				values: ["test_value"],
				related_tags: ["test_tag"],
			},
		],
		people: [
			{
				id: "test-person-1",
				name: "Test Person",
				description: "Test description",
				segment: "Test Segment",
				contact_info: "test@example.com",
			},
		],
	}),
}))

vi.mock("consola")

// Mock AssemblyAI API
global.fetch = vi.fn()

describe("Onboarding Pipeline Integration", () => {
	beforeEach(async () => {
		await seedTestData()
		vi.clearAllMocks()
	})

	afterAll(async () => {
		await testDb.removeAllChannels()
	})

	describe("Complete Onboarding Flow", () => {
		it("should complete full pipeline from upload to ready status", async () => {
			// Mock successful AssemblyAI upload
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						upload_url: "https://api.assemblyai.com/v2/upload/test-123",
					}),
			} as Response)

			// Mock successful transcription start
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						id: "transcript-123",
						status: "queued",
					}),
			} as Response)

			// Step 1: Start onboarding
			const formData = new FormData()
			formData.append("fileName", "test-interview.mp3")
			formData.append("fileType", "audio/mpeg")
			formData.append("projectTitle", "Test Project")
			formData.append("customInstructions", "Test instructions")

			// Mock file data
			const mockFile = new File(["test audio data"], "test-interview.mp3", {
				type: "audio/mpeg",
			})
			formData.append("audioFile", mockFile)

			const onboardingRequest = new Request("http://localhost/api/onboarding-start", {
				method: "POST",
				body: formData,
			})

			const onboardingResponse = await onboardingAction({ request: onboardingRequest })
			expect(onboardingResponse.status).toBe(200)

			const onboardingResult = await onboardingResponse.json()
			expect(onboardingResult.success).toBe(true)
			expect(onboardingResult.interviewId).toBeDefined()

			const interviewId = onboardingResult.interviewId

			// Verify database state after onboarding
			const { data: interview } = await testDb.from("interviews").select("*").eq("id", interviewId).single()

			expect(interview?.status).toBe("uploaded")
			expect(interview?.title).toBe("Test Project")

			const { data: uploadJob } = await testDb.from("upload_jobs").select("*").eq("interview_id", interviewId).single()

			expect(uploadJob?.assemblyai_id).toBe("transcript-123")
			expect(uploadJob?.status).toBe("in_progress")

			// Verify onboarding completion flag
			const { data: userSettings } = await testDb
				.from("user_settings")
				.select("*")
				.eq("user_id", TEST_ACCOUNT_ID)
				.single()

			expect(userSettings?.onboarding_completed).toBe(true)

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
			} as Response)

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
				text: "This is a test transcript about user research and insights.",
				confidence: 0.95,
				audio_duration: 180,
			}

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const webhookResponse = await webhookAction({ request: webhookRequest })
			expect(webhookResponse.status).toBe(200)

			const webhookResult = await webhookResponse.json()
			expect(webhookResult.success).toBe(true)

			// Verify final database state
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interviewId).single()

			expect(finalInterview?.status).toBe("ready")
			expect(finalInterview?.transcript).toBe("This is a test transcript about user research and insights.")
			expect(finalInterview?.duration_min).toBe(3) // 180 seconds = 3 minutes

			const { data: finalUploadJob } = await testDb
				.from("upload_jobs")
				.select("*")
				.eq("interview_id", interviewId)
				.single()

			expect(finalUploadJob?.status).toBe("done")

			const { data: analysisJob } = await testDb
				.from("analysis_jobs")
				.select("*")
				.eq("interview_id", interviewId)
				.single()

			expect(analysisJob?.status).toBe("done")
			expect(analysisJob?.progress).toBe(100)

			// Verify insights and people were created
			const { data: insights } = await testDb.from("insights").select("*").eq("interview_id", interviewId)

			expect(insights).toHaveLength(1)
			expect(insights?.[0]?.name).toBe("Test Insight")

			const { data: people } = await testDb.from("interview_people").select("people(*)").eq("interview_id", interviewId)

			expect(people).toHaveLength(1)
		})

		it("should handle webhook idempotency correctly", async () => {
			// Create an interview with completed upload job
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: "test-interview-idempotent",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Idempotency Test",
					status: "ready",
					transcript: "Existing transcript",
				})
				.select()
				.single()

			await testDb.from("upload_jobs").insert({
				id: "test-upload-job-idempotent",
				interview_id: interview!.id,
				assemblyai_id: "transcript-456",
				status: "done", // Already completed
				custom_instructions: "Test instructions",
			})

			// Send webhook for already completed job
			const webhookPayload = {
				transcript_id: "transcript-456",
				status: "completed" as const,
				text: "New transcript that should be ignored",
			}

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const webhookResponse = await webhookAction({ request: webhookRequest })
			expect(webhookResponse.status).toBe(200)

			const webhookResult = await webhookResponse.json()
			expect(webhookResult.success).toBe(true)
			expect(webhookResult.message).toBe("Already processed")

			// Verify original transcript was not overwritten
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interview!.id).single()

			expect(finalInterview?.transcript).toBe("Existing transcript")
			expect(finalInterview?.status).toBe("ready")

			// Verify no duplicate analysis jobs were created
			const { data: analysisJobs } = await testDb.from("analysis_jobs").select("*").eq("interview_id", interview!.id)

			expect(analysisJobs).toHaveLength(0) // No analysis jobs should be created
		})

		it("should progress through correct status transitions", async () => {
			// Create interview in uploaded state
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: "test-interview-status",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Status Test",
					status: "uploaded",
				})
				.select()
				.single()

			await testDb.from("upload_jobs").insert({
				id: "test-upload-job-status",
				interview_id: interview!.id,
				assemblyai_id: "transcript-789",
				status: "pending",
				custom_instructions: "",
			})

			// Mock AssemblyAI transcript fetch
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						text: "Status progression test transcript",
						confidence: 0.9,
						audio_duration: 120,
					}),
			} as Response)

			// Track status changes by querying before and after
			const getStatus = async () => {
				const { data } = await testDb.from("interviews").select("status").eq("id", interview!.id).single()
				return data?.status
			}

			expect(await getStatus()).toBe("uploaded") // 20%

			// Send webhook
			const webhookPayload = {
				transcript_id: "transcript-789",
				status: "completed" as const,
				text: "Status progression test transcript",
			}

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			await webhookAction({ request: webhookRequest })

			// Final status should be ready (100%)
			expect(await getStatus()).toBe("ready")

			// Verify analysis job completed
			const { data: analysisJob } = await testDb
				.from("analysis_jobs")
				.select("*")
				.eq("interview_id", interview!.id)
				.single()

			expect(analysisJob?.status).toBe("done")
			expect(analysisJob?.progress).toBe(100)
		})
	})

	describe("Error Scenarios", () => {
		it("should handle transcription failures gracefully", async () => {
			// Create interview with pending upload job
			const { data: interview } = await testDb
				.from("interviews")
				.insert({
					id: "test-interview-error",
					account_id: TEST_ACCOUNT_ID,
					project_id: "test-project-123",
					title: "Error Test",
					status: "uploaded",
				})
				.select()
				.single()

			await testDb.from("upload_jobs").insert({
				id: "test-upload-job-error",
				interview_id: interview!.id,
				assemblyai_id: "transcript-error",
				status: "pending",
				custom_instructions: "",
			})

			// Send webhook with failed status
			const webhookPayload = {
				transcript_id: "transcript-error",
				status: "failed" as const,
			}

			const webhookRequest = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const webhookResponse = await webhookAction({ request: webhookRequest })
			expect(webhookResponse.status).toBe(200)

			// Verify error status was set
			const { data: finalInterview } = await testDb.from("interviews").select("*").eq("id", interview!.id).single()

			expect(finalInterview?.status).toBe("error")

			const { data: uploadJob } = await testDb
				.from("upload_jobs")
				.select("*")
				.eq("interview_id", interview!.id)
				.single()

			expect(uploadJob?.status).toBe("error")
			expect(uploadJob?.status_detail).toBe("Transcription failed")
			expect(uploadJob?.last_error).toContain("AssemblyAI transcription failed")
		})
	})
})
