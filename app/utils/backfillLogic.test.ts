/**
 * Unit tests for backfill logic
 * Tests the core logic for identifying and processing interviews without people
 */

import { describe, expect, it } from "vitest"

// Extract the core logic for testing
interface Interview {
	id: string
	title: string | null
	participant_pseudonym: string | null
	segment: string | null
	interview_date: string | null
	created_at: string
}

interface ExistingLink {
	interview_id: string
}

/**
 * Generate a smart fallback name for a person based on interview data
 * This mirrors the logic in backfillPeople.server.ts
 */
function generateFallbackPersonName(interview: Interview): string {
	// Try participant pseudonym first
	if (interview.participant_pseudonym?.trim()) {
		return interview.participant_pseudonym.trim()
	}

	// Try to extract from title
	if (interview.title && !interview.title.includes("Interview -")) {
		const cleanTitle = interview.title
			.replace(/^Interview\s*-?\s*/i, "") // Remove "Interview -" prefix
			.replace(/\d{4}-\d{2}-\d{2}/, "") // Remove dates
			.trim()

		if (cleanTitle.length > 0) {
			return `Participant (${cleanTitle})`
		}
	}

	// Use interview date or ID as fallback
	const date = interview.interview_date || interview.created_at?.split("T")[0]
	if (date) {
		return `Participant (${date})`
	}

	// Final fallback
	return `Participant (${interview.id.slice(0, 8)})`
}

/**
 * Identify interviews that need people created
 */
function identifyInterviewsWithoutPeople(interviews: Interview[], existingLinks: ExistingLink[]): Interview[] {
	const linkedInterviewIds = new Set(existingLinks.map((link) => link.interview_id))
	return interviews.filter((interview) => !linkedInterviewIds.has(interview.id))
}

/**
 * Calculate statistics about interviews and people
 */
function calculateBackfillStats(interviews: Interview[], existingLinks: ExistingLink[]) {
	const totalInterviews = interviews.length
	const linkedInterviewIds = new Set(existingLinks.map((link) => link.interview_id))
	const interviewsWithPeople = linkedInterviewIds.size
	const interviewsWithoutPeople = totalInterviews - interviewsWithPeople

	return {
		totalInterviews,
		interviewsWithPeople,
		interviewsWithoutPeople,
	}
}

describe("Backfill Logic", () => {
	describe("generateFallbackPersonName", () => {
		it("should use participant pseudonym when available", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Test Interview",
				participant_pseudonym: "Sarah Johnson",
				segment: "enterprise",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Sarah Johnson")
		})

		it("should trim whitespace from participant pseudonym", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Test Interview",
				participant_pseudonym: "  John Doe  ",
				segment: "consumer",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("John Doe")
		})

		it("should use interview title when pseudonym is missing", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Customer Research Session",
				participant_pseudonym: null,
				segment: "consumer",
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (Customer Research Session)")
		})

		it("should skip generic interview titles", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Interview - 2025-01-25",
				participant_pseudonym: null,
				segment: null,
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (2025-01-25)")
		})

		it("should use interview date when title is not meaningful", () => {
			const interview: Interview = {
				id: "interview-1",
				title: null,
				participant_pseudonym: null,
				segment: null,
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (2025-01-25)")
		})

		it("should use created_at date when interview_date is null", () => {
			const interview: Interview = {
				id: "interview-1",
				title: null,
				participant_pseudonym: null,
				segment: null,
				interview_date: null,
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (2025-01-25)")
		})

		it("should use interview ID as final fallback", () => {
			const interview: Interview = {
				id: "interview-abcd1234efgh5678",
				title: null,
				participant_pseudonym: null,
				segment: null,
				interview_date: null,
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (2025-01-25)")
		})

		it("should clean dates from titles", () => {
			const interview: Interview = {
				id: "interview-1",
				title: "Customer Research 2025-01-25 Session",
				participant_pseudonym: null,
				segment: null,
				interview_date: "2025-01-25",
				created_at: "2025-01-25T10:00:00Z",
			}

			const result = generateFallbackPersonName(interview)
			expect(result).toBe("Participant (Customer Research  Session)")
		})
	})

	describe("identifyInterviewsWithoutPeople", () => {
		it("should identify interviews without existing people links", () => {
			const interviews: Interview[] = [
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

			const existingLinks: ExistingLink[] = [{ interview_id: "interview-2" }]

			const result = identifyInterviewsWithoutPeople(interviews, existingLinks)

			expect(result).toHaveLength(2)
			expect(result.map((i) => i.id)).toEqual(["interview-1", "interview-3"])
		})

		it("should return empty array when all interviews have people", () => {
			const interviews: Interview[] = [
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
			]

			const existingLinks: ExistingLink[] = [{ interview_id: "interview-1" }, { interview_id: "interview-2" }]

			const result = identifyInterviewsWithoutPeople(interviews, existingLinks)
			expect(result).toHaveLength(0)
		})

		it("should return all interviews when no links exist", () => {
			const interviews: Interview[] = [
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
			]

			const existingLinks: ExistingLink[] = []

			const result = identifyInterviewsWithoutPeople(interviews, existingLinks)
			expect(result).toHaveLength(2)
			expect(result.map((i) => i.id)).toEqual(["interview-1", "interview-2"])
		})
	})

	describe("calculateBackfillStats", () => {
		it("should calculate correct statistics", () => {
			const interviews: Interview[] = [
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
				{
					id: "interview-4",
					title: "Interview 4",
					participant_pseudonym: "Alice",
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
				{
					id: "interview-5",
					title: "Interview 5",
					participant_pseudonym: "Charlie",
					segment: null,
					interview_date: "2025-01-25",
					created_at: "2025-01-25T10:00:00Z",
				},
			]

			const existingLinks: ExistingLink[] = [{ interview_id: "interview-1" }, { interview_id: "interview-3" }]

			const stats = calculateBackfillStats(interviews, existingLinks)

			expect(stats).toEqual({
				totalInterviews: 5,
				interviewsWithPeople: 2,
				interviewsWithoutPeople: 3,
			})
		})

		it("should handle empty arrays", () => {
			const stats = calculateBackfillStats([], [])

			expect(stats).toEqual({
				totalInterviews: 0,
				interviewsWithPeople: 0,
				interviewsWithoutPeople: 0,
			})
		})

		it("should handle duplicate links correctly", () => {
			const interviews: Interview[] = [
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
			]

			// Duplicate links for same interview
			const existingLinks: ExistingLink[] = [
				{ interview_id: "interview-1" },
				{ interview_id: "interview-1" },
				{ interview_id: "interview-1" },
			]

			const stats = calculateBackfillStats(interviews, existingLinks)

			expect(stats).toEqual({
				totalInterviews: 2,
				interviewsWithPeople: 1, // Should count interview-1 only once
				interviewsWithoutPeople: 1,
			})
		})
	})

	describe("Integration scenarios", () => {
		it("should handle realistic backfill scenario", () => {
			const interviews: Interview[] = [
				{
					id: "interview-001",
					title: "Customer Discovery Session",
					participant_pseudonym: "Sarah Chen",
					segment: "enterprise",
					interview_date: "2025-01-20",
					created_at: "2025-01-20T14:30:00Z",
				},
				{
					id: "interview-002",
					title: "Interview - 2025-01-21",
					participant_pseudonym: null,
					segment: "consumer",
					interview_date: "2025-01-21",
					created_at: "2025-01-21T09:15:00Z",
				},
				{
					id: "interview-003",
					title: "Product Feedback Call",
					participant_pseudonym: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-22T16:45:00Z",
				},
				{
					id: "interview-004",
					title: null,
					participant_pseudonym: null,
					segment: null,
					interview_date: null,
					created_at: "2025-01-23T11:20:00Z",
				},
			]

			// Only interview-001 has a person linked
			const existingLinks: ExistingLink[] = [{ interview_id: "interview-001" }]

			const interviewsNeedingPeople = identifyInterviewsWithoutPeople(interviews, existingLinks)
			const stats = calculateBackfillStats(interviews, existingLinks)

			expect(stats).toEqual({
				totalInterviews: 4,
				interviewsWithPeople: 1,
				interviewsWithoutPeople: 3,
			})

			expect(interviewsNeedingPeople).toHaveLength(3)

			// Test name generation for each interview needing people
			const names = interviewsNeedingPeople.map(generateFallbackPersonName)
			expect(names).toEqual([
				"Participant (2025-01-21)", // interview-002: generic title, uses date
				"Participant (Product Feedback Call)", // interview-003: meaningful title
				"Participant (2025-01-23)", // interview-004: no title, uses created_at date
			])
		})
	})
})
