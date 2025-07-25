/**
 * Unit tests for processInterview.server.ts
 * Tests the person creation logic and smart fallback naming
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Database } from "~/../supabase/types"

// Mock dependencies
vi.mock("~/lib/supabase/server")
vi.mock("consola")
vi.mock("~/lib/baml/client")

// Import after mocking
const { processInterviewTranscript } = await import("./processInterview.server")
const { getServerClient } = await import("~/lib/supabase/server")
const consola = await import("consola")
const { b } = await import("~/lib/baml/client")

// Create mock Supabase client
const createMockSupabaseClient = () => {
	const mockClient = {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
		auth: {
			getUser: vi.fn(),
		},
	} as unknown as SupabaseClient<Database>

	// Setup default successful responses
	const mockResponse = { data: null, error: null }
	mockClient.from = vi.fn(() => ({
		select: vi.fn().mockReturnThis(),
		insert: vi.fn(() => ({ data: { id: "test-id" }, error: null })),
		upsert: vi.fn(() => ({
			select: vi.fn(() => ({
				single: vi.fn(() => ({ data: { id: "person-id" }, error: null })),
			})),
		})),
		eq: vi.fn().mockReturnThis(),
		single: vi.fn(() => mockResponse),
	})) as any

	return mockClient
}

describe("processInterviewTranscript", () => {
	let mockSupabaseClient: SupabaseClient<Database>
	let mockRequest: Request

	beforeEach(() => {
		vi.clearAllMocks()
		mockSupabaseClient = createMockSupabaseClient()
		mockRequest = new Request("http://localhost:3000")

		// Mock getServerClient to return our mock
		const { getServerClient } = require("~/lib/supabase/server")
		;(getServerClient as MockedFunction<any>).mockReturnValue({
			client: mockSupabaseClient,
			auth: mockSupabaseClient.auth,
		})
	})

	describe("Person Creation Logic", () => {
		const baseMetadata = {
			accountId: "account-123",
			projectId: "project-123",
			interviewId: "interview-123",
			fileName: "test_interview_john_doe.mp3",
		}

		const mockTranscriptData = {
			text: "Hello, this is a test interview.",
			speakers: [
				{ speaker: "A", text: "Hello" },
				{ speaker: "B", text: "Hi there" },
			],
			topics: [],
			sentiment_analysis_results: [],
		}

		it("should create person with AI-extracted name when available", async () => {
			// Mock BAML to return extracted name
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({
				name: "John Doe",
				age: 30,
				occupation: "Engineer",
			})
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: "tech_professional" })

			// Mock successful person upsert
			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))
			mockSupabaseClient.from = vi.fn(() => ({
				upsert: mockUpsert,
				insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
			})) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, baseMetadata)

			// Verify person was created with AI-extracted name
			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					account_id: "account-123",
					name: "John Doe",
					age: 30,
					occupation: "Engineer",
				}),
				{ onConflict: "account_id,name_hash" }
			)
		})

		it("should create person with filename fallback when AI extraction fails", async () => {
			// Mock BAML to return no name
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({
				name: "", // Empty name
				age: null,
				occupation: null,
			})
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))
			mockSupabaseClient.from = vi.fn(() => ({
				upsert: mockUpsert,
				insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
			})) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, baseMetadata)

			// Verify person was created with filename-based fallback
			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					account_id: "account-123",
					name: "Participant (Test Interview John Doe)", // Cleaned filename
				}),
				{ onConflict: "account_id,name_hash" }
			)
		})

		it("should handle various filename formats correctly", async () => {
			const testCases = [
				{
					fileName: "interview_sarah_smith.wav",
					expectedName: "Participant (Interview Sarah Smith)",
				},
				{
					fileName: "customer_feedback_session.mp3",
					expectedName: "Participant (Customer Feedback Session)",
				},
				{
					fileName: "user-research-2025-01-25.m4a",
					expectedName: "Participant (User Research 2025 01 25)",
				},
				{
					fileName: "MEETING_RECORDING.MP3",
					expectedName: "Participant (Meeting Recording)",
				},
			]

			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			for (const testCase of testCases) {
				const mockUpsert = vi.fn(() => ({
					select: vi.fn(() => ({
						single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
					})),
				}))
				mockSupabaseClient.from = vi.fn(() => ({
					upsert: mockUpsert,
					insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
				})) as any

				await processInterviewTranscript(mockRequest, mockTranscriptData, {
					...baseMetadata,
					fileName: testCase.fileName,
				})

				expect(mockUpsert).toHaveBeenCalledWith(
					expect.objectContaining({
						name: testCase.expectedName,
					}),
					{ onConflict: "account_id,name_hash" }
				)

				vi.clearAllMocks()
			}
		})

		it("should use interview title fallback when filename is not meaningful", async () => {
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))
			mockSupabaseClient.from = vi.fn(() => ({
				upsert: mockUpsert,
				insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
			})) as any

			// Mock interview fetch to return title
			const mockSelect = vi.fn(() => ({
				eq: vi.fn(() => ({
					single: vi.fn(() => ({
						data: { title: "Customer Research Session", interview_date: "2025-01-25" },
						error: null,
					})),
				})),
			}))
			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return { select: mockSelect }
				}
				return {
					upsert: mockUpsert,
					insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
				}
			}) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, {
				...baseMetadata,
				fileName: "recording.mp3", // Non-meaningful filename
			})

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Participant (Customer Research Session)",
				}),
				{ onConflict: "account_id,name_hash" }
			)
		})

		it("should use date fallback when title is not available", async () => {
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))

			// Mock interview fetch to return date but no title
			const mockSelect = vi.fn(() => ({
				eq: vi.fn(() => ({
					single: vi.fn(() => ({
						data: { title: null, interview_date: "2025-01-25" },
						error: null,
					})),
				})),
			}))
			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return { select: mockSelect }
				}
				return {
					upsert: mockUpsert,
					insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
				}
			}) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, {
				...baseMetadata,
				fileName: "rec.mp3",
			})

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Participant (2025-01-25)",
				}),
				{ onConflict: "account_id,name_hash" }
			)
		})

		it("should use interview ID fallback as last resort", async () => {
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))

			// Mock interview fetch to return no meaningful data
			const mockSelect = vi.fn(() => ({
				eq: vi.fn(() => ({
					single: vi.fn(() => ({
						data: { title: null, interview_date: null },
						error: null,
					})),
				})),
			}))
			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return { select: mockSelect }
				}
				return {
					upsert: mockUpsert,
					insert: vi.fn(() => ({ data: { id: "link-123" }, error: null })),
				}
			}) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, {
				...baseMetadata,
				fileName: "x.mp3",
				interviewId: "interview-abcd1234",
			})

			expect(mockUpsert).toHaveBeenCalledWith(
				expect.objectContaining({
					name: "Participant (abcd1234)", // Uses first 8 chars of interview ID
				}),
				{ onConflict: "account_id,name_hash" }
			)
		})

		it("should always create interview-people link regardless of person creation method", async () => {
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "Test User", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			const mockInsert = vi.fn(() => ({ data: { id: "link-123" }, error: null }))
			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-123" }, error: null })),
				})),
			}))

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "people") {
					return { upsert: mockUpsert }
				}
				return { insert: mockInsert }
			}) as any

			await processInterviewTranscript(mockRequest, mockTranscriptData, baseMetadata)

			// Verify interview-people link was created
			expect(mockInsert).toHaveBeenCalledWith({
				interview_id: "interview-123",
				person_id: "person-123",
				role: "participant",
			})
		})

		it("should handle person creation errors gracefully", async () => {
			const { b } = require("~/lib/baml/client")
			b.ExtractIntervieweeInfo.mockResolvedValue({ name: "Test User", age: null, occupation: null })
			b.ExtractInsights.mockResolvedValue([])
			b.ExtractOpportunities.mockResolvedValue([])
			b.ExtractPersona.mockResolvedValue({ persona: null })

			// Mock person creation failure
			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: null, error: { message: "Database error" } })),
				})),
			}))

			mockSupabaseClient.from = vi.fn(() => ({
				upsert: mockUpsert,
			})) as any

			// Should not throw error, but log it
			await expect(processInterviewTranscript(mockRequest, mockTranscriptData, baseMetadata)).resolves.not.toThrow()

			const consola = require("consola").default
			expect(consola.error).toHaveBeenCalledWith(expect.stringContaining("Failed to create person for interview"))
		})
	})
})
