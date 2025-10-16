/**
 * Unit tests for backfillPeople.server.ts
 * Tests the backfill utility for creating missing people records
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest"
import type { Database } from "~/../supabase/types"
import { backfillMissingPeople, getInterviewPeopleStats } from "./backfillPeople.server"

// Mock dependencies
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(),
}))

vi.mock("consola", () => ({
	default: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

// Create mock Supabase client
const createMockSupabaseClient = () => {
	const mockClient = {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		in: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
	} as unknown as SupabaseClient<Database>

	return mockClient
}

describe("backfillMissingPeople", () => {
	let mockSupabaseClient: SupabaseClient<Database>
	let mockRequest: Request

	beforeEach(() => {
		vi.clearAllMocks()
		mockSupabaseClient = createMockSupabaseClient()
		mockRequest = new Request("http://localhost:3000")

		// Mock getServerClient to return our mock
		const { getServerClient } = require("~/lib/supabase/client.server")
		;(getServerClient as MockedFunction<any>).mockReturnValue({
			client: mockSupabaseClient,
		})
	})

	describe("Smart Name Generation", () => {
		it("should generate names from participant pseudonym", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Test Interview",
					participant_pseudonym: "Sarah Johnson",
					segment: "enterprise",
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = [] // No existing links

			// Setup mock responses
			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn(() => ({
							select: vi.fn(() => ({
								single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
							})),
						})),
					}
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(1)
			expect(result.linksCreated).toBe(1)
			expect(result.errors).toHaveLength(0)
		})

		it("should generate names from interview title when pseudonym is missing", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Customer Research Session",
					participant_pseudonym: null,
					segment: "consumer",
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn((data) => {
							expect(data.name).toBe("Participant (Customer Research Session)")
							return {
								select: vi.fn(() => ({
									single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
								})),
							}
						}),
					}
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(1)
		})

		it("should generate names from interview date when title is generic", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Interview - 2025-01-25",
					participant_pseudonym: null,
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn((data) => {
							expect(data.name).toBe("Participant (2025-01-25)")
							return {
								select: vi.fn(() => ({
									single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
								})),
							}
						}),
					}
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(1)
		})

		it("should use interview ID as final fallback", async () => {
			const mockInterviews = [
				{
					id: "interview-abcd1234efgh5678",
					title: null,
					participant_pseudonym: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn((data) => {
							expect(data.name).toBe("Participant (abcd1234)")
							return {
								select: vi.fn(() => ({
									single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
								})),
							}
						}),
					}
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(1)
		})
	})

	describe("Dry Run Mode", () => {
		it("should not create any records in dry run mode", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Test Interview",
					participant_pseudonym: "John Doe",
					segment: "enterprise",
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			const mockUpsert = vi.fn()
			const mockInsert = vi.fn()

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return { upsert: mockUpsert }
				}
				return { insert: mockInsert }
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: true,
			})

			expect(result.peopleCreated).toBe(1)
			expect(result.linksCreated).toBe(1)
			expect(mockUpsert).not.toHaveBeenCalled()
			expect(mockInsert).not.toHaveBeenCalled()

			const consola = require("consola").default
			expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('[DRY RUN] Would create person "John Doe"'))
		})
	})

	describe("Error Handling", () => {
		it("should handle interview fetch errors", async () => {
			mockSupabaseClient.from = vi.fn(() => ({
				select: vi.fn(() => ({
					eq: vi.fn(() => ({ data: null, error: { message: "Database connection failed" } })),
				})),
			})) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain("Failed to fetch interviews")
		})

		it("should handle person creation errors gracefully", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Test Interview",
					participant_pseudonym: "John Doe",
					segment: "enterprise",
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn(() => ({
							select: vi.fn(() => ({
								single: vi.fn(() => ({ data: null, error: { message: "Constraint violation" } })),
							})),
						})),
					}
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(0)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain("Failed to create person for interview interview-1")
		})

		it("should handle link creation errors gracefully", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Test Interview",
					participant_pseudonym: "John Doe",
					segment: "enterprise",
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const mockExistingLinks: any[] = []

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return {
						upsert: vi.fn(() => ({
							select: vi.fn(() => ({
								single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
							})),
						})),
					}
				}
				return {
					insert: vi.fn(() => ({ data: null, error: { message: "Foreign key constraint" } })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.peopleCreated).toBe(1)
			expect(result.linksCreated).toBe(0)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain("Failed to create link for interview interview-1")
		})
	})

	describe("Filtering Logic", () => {
		it("should only process interviews without existing people", async () => {
			const mockInterviews = [
				{
					id: "interview-1",
					title: "Interview 1",
					participant_pseudonym: "John",
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
				{
					id: "interview-2",
					title: "Interview 2",
					participant_pseudonym: "Jane",
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
				{
					id: "interview-3",
					title: "Interview 3",
					participant_pseudonym: "Bob",
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			// Interview 2 already has a person linked
			const mockExistingLinks = [{ interview_id: "interview-2" }]

			const mockUpsert = vi.fn(() => ({
				select: vi.fn(() => ({
					single: vi.fn(() => ({ data: { id: "person-1" }, error: null })),
				})),
			}))

			mockSupabaseClient.from = vi.fn((table) => {
				if (table === "interviews") {
					return {
						select: vi.fn(() => ({
							eq: vi.fn(() => ({ data: mockInterviews, error: null })),
						})),
					}
				}
				if (table === "interview_people") {
					return {
						select: vi.fn(() => ({
							in: vi.fn(() => ({ data: mockExistingLinks, error: null })),
						})),
					}
				}
				if (table === "people") {
					return { upsert: mockUpsert }
				}
				return {
					insert: vi.fn(() => ({ data: { id: "link-1" }, error: null })),
				}
			}) as any

			const result = await backfillMissingPeople(mockRequest, {
				accountId: "account-123",
				dryRun: false,
			})

			expect(result.totalInterviews).toBe(3)
			expect(result.interviewsWithoutPeople).toBe(2)
			expect(result.peopleCreated).toBe(2)
			expect(result.linksCreated).toBe(2)

			// Should only create people for interviews 1 and 3
			expect(mockUpsert).toHaveBeenCalledTimes(2)
		})
	})
})

describe("getInterviewPeopleStats", () => {
	let mockSupabaseClient: SupabaseClient<Database>
	let mockRequest: Request

	beforeEach(() => {
		vi.clearAllMocks()
		mockSupabaseClient = createMockSupabaseClient()
		mockRequest = new Request("http://localhost:3000")

		const { getServerClient } = require("~/lib/supabase/client.server")
		;(getServerClient as MockedFunction<any>).mockReturnValue({
			client: mockSupabaseClient,
		})
	})

	it("should return correct statistics", async () => {
		const mockLinkedInterviews = [{ interview_id: "interview-1" }, { interview_id: "interview-2" }]

		const mockPeopleNames = [
			{ name: "John Doe" },
			{ name: "Jane Smith" },
			{ name: "John Doe" }, // Duplicate
			{ name: "Bob Wilson" },
		]

		mockSupabaseClient.from = vi.fn((table) => {
			if (table === "interviews") {
				return {
					select: vi.fn(() => ({
						eq: vi.fn(() => ({ count: 5 })), // 5 total interviews
					})),
				}
			}
			if (table === "people") {
				return {
					select: vi.fn((columns) => {
						if (columns === "*") {
							return {
								eq: vi.fn(() => ({ count: 4 })), // 4 total people
							}
						}
						return {
							eq: vi.fn(() => ({ data: mockPeopleNames, error: null })),
						}
					}),
				}
			}
			if (table === "interview_people") {
				return {
					select: vi.fn(() => ({
						in: vi.fn(() => ({ data: mockLinkedInterviews, error: null })),
					})),
				}
			}
			return { select: vi.fn() }
		}) as any

		const stats = await getInterviewPeopleStats(mockRequest, "account-123")

		expect(stats).toEqual({
			totalInterviews: 5,
			totalPeople: 4,
			interviewsWithPeople: 2,
			interviewsWithoutPeople: 3,
			duplicatePeople: 1, // Only "John Doe" appears twice
		})
	})
})
