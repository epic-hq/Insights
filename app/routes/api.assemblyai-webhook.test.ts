import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { action } from "./api.assemblyai-webhook"

// Mock dependencies
vi.mock("~/lib/supabase/server")
vi.mock("~/utils/processInterview.server")
vi.mock("consola")

const mockSupabaseAdmin = {
	from: vi.fn(),
}

const mockProcessInterview = vi.fn()

// Mock the admin client
vi.mocked(import("~/lib/supabase/server")).mockResolvedValue({
	createSupabaseAdminClient: () => mockSupabaseAdmin,
})

// Mock the processing function
vi.mocked(import("~/utils/processInterview.server")).mockResolvedValue({
	processInterviewTranscriptWithAdminClient: mockProcessInterview,
})

describe("AssemblyAI Webhook API", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		
		// Setup default mock chain for database operations
		const mockSelect = vi.fn().mockReturnThis()
		const mockEq = vi.fn().mockReturnThis()
		const mockSingle = vi.fn()
		const mockUpdate = vi.fn().mockReturnThis()
		const mockInsert = vi.fn().mockReturnThis()

		mockSupabaseAdmin.from.mockReturnValue({
			select: mockSelect,
			update: mockUpdate,
			insert: mockInsert,
		})

		mockSelect.mockReturnValue({
			eq: mockEq,
		})

		mockEq.mockReturnValue({
			single: mockSingle,
		})

		mockUpdate.mockReturnValue({
			eq: mockEq,
		})

		mockInsert.mockReturnValue({
			select: mockSelect,
		})
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe("HTTP Method Validation", () => {
		it("should reject non-POST requests", async () => {
			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "GET",
			})

			const response = await action({ request })
			expect(response.status).toBe(405)
			
			const result = await response.json()
			expect(result.error).toBe("Method not allowed")
		})
	})

	describe("Webhook Idempotency", () => {
		it("should skip processing when upload job status is already 'done'", async () => {
			// Mock finding an already completed upload job
			const mockSingle = vi.fn().mockResolvedValue({
				data: {
					id: "upload-job-123",
					interview_id: "interview-123",
					status: "done", // Already completed
					file_name: "test.mp3",
				},
				error: null,
			})

			mockSupabaseAdmin.from.mockReturnValue({
				select: () => ({
					eq: () => ({
						single: mockSingle,
					}),
				}),
			})

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
				text: "Test transcript",
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const response = await action({ request })
			expect(response.status).toBe(200)
			
			const result = await response.json()
			expect(result.success).toBe(true)
			expect(result.message).toBe("Already processed")

			// Verify no processing functions were called
			expect(mockProcessInterview).not.toHaveBeenCalled()
		})

		it("should process normally when upload job status is pending", async () => {
			// Mock finding a pending upload job
			const mockSingle = vi.fn().mockResolvedValue({
				data: {
					id: "upload-job-123",
					interview_id: "interview-123",
					status: "pending", // Still needs processing
					file_name: "test.mp3",
					custom_instructions: "Test instructions",
				},
				error: null,
			})

			// Mock interview fetch
			const mockInterviewSingle = vi.fn().mockResolvedValue({
				data: {
					id: "interview-123",
					account_id: "user-123",
					project_id: "project-123",
					title: "Test Interview",
					media_url: "https://example.com/audio.mp3",
				},
				error: null,
			})

			// Mock successful database updates
			const mockUpdate = vi.fn().mockResolvedValue({ error: null })
			const mockInsertAnalysis = vi.fn().mockResolvedValue({
				data: { id: "analysis-job-123" },
				error: null,
			})

			mockSupabaseAdmin.from.mockImplementation((table: string) => {
				if (table === "upload_jobs") {
					return {
						select: () => ({
							eq: () => ({
								single: mockSingle,
							}),
						}),
						update: () => ({
							eq: mockUpdate,
						}),
					}
				}
				if (table === "interviews") {
					return {
						select: () => ({
							eq: () => ({
								single: mockInterviewSingle,
							}),
						}),
						update: () => ({
							eq: mockUpdate,
						}),
					}
				}
				if (table === "analysis_jobs") {
					return {
						insert: () => ({
							select: () => ({
								single: mockInsertAnalysis,
							}),
						}),
						update: () => ({
							eq: mockUpdate,
						}),
					}
				}
				return { from: vi.fn() }
			})

			// Mock successful AssemblyAI API response
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({
					text: "This is a test transcript",
					confidence: 0.95,
					audio_duration: 120,
				}),
			})

			// Mock successful processing
			mockProcessInterview.mockResolvedValue({
				success: true,
				insights: [],
				people: [],
			})

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
				text: "Test transcript",
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const response = await action({ request })
			expect(response.status).toBe(200)
			
			const result = await response.json()
			expect(result.success).toBe(true)

			// Verify processing was called
			expect(mockProcessInterview).toHaveBeenCalledOnce()
		})
	})

	describe("Status Progression", () => {
		it("should update interview status through correct progression", async () => {
			const statusUpdates: string[] = []
			
			// Track all status updates
			const mockUpdate = vi.fn().mockImplementation((data: any) => {
				if (data.status) {
					statusUpdates.push(data.status)
				}
				return { eq: vi.fn().mockResolvedValue({ error: null }) }
			})

			// Mock pending upload job
			const mockSingle = vi.fn().mockResolvedValue({
				data: {
					id: "upload-job-123",
					interview_id: "interview-123",
					status: "pending",
					file_name: "test.mp3",
					custom_instructions: "",
				},
				error: null,
			})

			// Mock interview fetch
			const mockInterviewSingle = vi.fn().mockResolvedValue({
				data: {
					id: "interview-123",
					account_id: "user-123",
					project_id: "project-123",
					title: "Test Interview",
					media_url: "https://example.com/audio.mp3",
				},
				error: null,
			})

			mockSupabaseAdmin.from.mockImplementation((table: string) => {
				if (table === "interviews") {
					return {
						select: () => ({
							eq: () => ({
								single: mockInterviewSingle,
							}),
						}),
						update: mockUpdate,
					}
				}
				if (table === "upload_jobs") {
					return {
						select: () => ({
							eq: () => ({
								single: mockSingle,
							}),
						}),
						update: () => ({
							eq: vi.fn().mockResolvedValue({ error: null }),
						}),
					}
				}
				if (table === "analysis_jobs") {
					return {
						insert: () => ({
							select: () => ({
								single: vi.fn().mockResolvedValue({
									data: { id: "analysis-job-123" },
									error: null,
								}),
							}),
						}),
						update: () => ({
							eq: vi.fn().mockResolvedValue({ error: null }),
						}),
					}
				}
				return { from: vi.fn() }
			})

			// Mock AssemblyAI API
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({
					text: "Test transcript",
					confidence: 0.95,
					audio_duration: 120,
				}),
			})

			// Mock processing
			mockProcessInterview.mockResolvedValue({ success: true })

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			await action({ request })

			// Verify correct status progression
			expect(statusUpdates).toEqual([
				"transcribed", // After transcript received
				"processing", // Before analysis starts  
				"ready",     // After analysis completes
			])
		})
	})

	describe("Error Handling", () => {
		it("should return 404 when upload job not found", async () => {
			const mockSingle = vi.fn().mockResolvedValue({
				data: null,
				error: { message: "Not found" },
			})

			mockSupabaseAdmin.from.mockReturnValue({
				select: () => ({
					eq: () => ({
						single: mockSingle,
					}),
				}),
			})

			const webhookPayload = {
				transcript_id: "nonexistent-transcript",
				status: "completed" as const,
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const response = await action({ request })
			expect(response.status).toBe(404)
			
			const result = await response.json()
			expect(result.error).toBe("Upload job not found")
		})

		it("should handle AssemblyAI API failure gracefully", async () => {
			// Mock pending upload job
			const mockSingle = vi.fn().mockResolvedValue({
				data: {
					id: "upload-job-123",
					interview_id: "interview-123",
					status: "pending",
					file_name: "test.mp3",
				},
				error: null,
			})

			mockSupabaseAdmin.from.mockReturnValue({
				select: () => ({
					eq: () => ({
						single: mockSingle,
					}),
				}),
			})

			// Mock failed AssemblyAI API response
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
			})

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "completed" as const,
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const response = await action({ request })
			expect(response.status).toBe(500)
		})

		it("should handle failed transcription status", async () => {
			// Mock pending upload job
			const mockSingle = vi.fn().mockResolvedValue({
				data: {
					id: "upload-job-123",
					interview_id: "interview-123",
					status: "pending",
					file_name: "test.mp3",
				},
				error: null,
			})

			const mockUpdate = vi.fn().mockResolvedValue({ error: null })

			mockSupabaseAdmin.from.mockImplementation((table: string) => {
				if (table === "upload_jobs") {
					return {
						select: () => ({
							eq: () => ({
								single: mockSingle,
							}),
						}),
						update: () => ({
							eq: mockUpdate,
						}),
					}
				}
				if (table === "interviews") {
					return {
						update: () => ({
							eq: mockUpdate,
						}),
					}
				}
				return { from: vi.fn() }
			})

			const webhookPayload = {
				transcript_id: "transcript-123",
				status: "failed" as const,
			}

			const request = new Request("http://localhost/api/assemblyai-webhook", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(webhookPayload),
			})

			const response = await action({ request })
			expect(response.status).toBe(200)
			
			const result = await response.json()
			expect(result.success).toBe(true)

			// Verify error status was set
			expect(mockUpdate).toHaveBeenCalledWith({
				status: "error",
				status_detail: "Transcription failed",
				last_error: "AssemblyAI transcription failed with status: failed",
			})
		})
	})
})