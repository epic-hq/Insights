/**
 * Integration tests for backfill operations
 * Tests real DB operations with seeded data - no mocks
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import {
	createTestRequest,
	getTestDbState,
	mockTestAuth,
	seedTestData,
	TEST_ACCOUNT_ID,
	testDb,
} from "~/test/utils/testDb"
import { backfillMissingPeople, getInterviewPeopleStats } from "~/utils/backfillPeople.server"

// Mock only external services, not DB operations
vi.mock("~/lib/supabase/server", () => ({
	getServerClient: () => mockTestAuth(),
}))

describe("Backfill Integration Tests", () => {
	beforeEach(async () => {
		await seedTestData()
	})

	afterAll(async () => {
		await testDb.removeAllChannels()
	})

	describe("getInterviewPeopleStats", () => {
		it("should calculate correct statistics from real DB", async () => {
			const request = createTestRequest()
			const stats = await getInterviewPeopleStats(request, TEST_ACCOUNT_ID)

			expect(stats).toEqual({
				totalInterviews: 3,
				totalPeople: 1,
				interviewsWithPeople: 1, // Only interview-1 has person linked
				interviewsWithoutPeople: 2, // interview-2 and interview-3 need people
				duplicatePeople: 0, // No duplicate names
			})
		})

		it("should handle empty database", async () => {
			// Clear all test data
			await testDb.from("interview_people").delete().neq("id", "none")
			await testDb.from("people").delete().eq("account_id", TEST_ACCOUNT_ID)
			await testDb.from("interviews").delete().eq("account_id", TEST_ACCOUNT_ID)

			const request = createTestRequest()
			const stats = await getInterviewPeopleStats(request, TEST_ACCOUNT_ID)

			expect(stats).toEqual({
				totalInterviews: 0,
				totalPeople: 0,
				interviewsWithPeople: 0,
				interviewsWithoutPeople: 0,
				duplicatePeople: 0,
			})
		})
	})

	describe("backfillMissingPeople", () => {
		it("should create people for interviews without them", async () => {
			const request = createTestRequest()

			// Verify initial state
			const initialState = await getTestDbState()
			expect(initialState.interviews).toHaveLength(3)
			expect(initialState.people).toHaveLength(1)
			expect(initialState.interviewPeopleLinks).toHaveLength(1)

			// Run backfill
			const result = await backfillMissingPeople(request, {
				accountId: TEST_ACCOUNT_ID,
				dryRun: false,
			})

			// Verify results
			expect(result.totalInterviews).toBe(3)
			expect(result.interviewsWithoutPeople).toBe(2)
			expect(result.peopleCreated).toBe(2)
			expect(result.linksCreated).toBe(2)
			expect(result.errors).toHaveLength(0)

			// Verify database state
			const finalState = await getTestDbState()
			expect(finalState.people).toHaveLength(3) // 1 existing + 2 created
			expect(finalState.interviewPeopleLinks).toHaveLength(3) // 1 existing + 2 created

			// Verify person names follow fallback logic
			const newPeople = finalState.people.filter((p) => p.id !== "person-1")
			expect(newPeople).toHaveLength(2)

			// Should use date fallback for interview-2 (generic title)
			const person2 = newPeople.find((p) => p.name === "Participant (2025-01-21)")
			expect(person2).toBeDefined()

			// Should use title for interview-3 (meaningful title)
			const person3 = newPeople.find((p) => p.name === "Participant (Product Feedback Call)")
			expect(person3).toBeDefined()
		})

		it("should handle dry run mode correctly", async () => {
			const request = createTestRequest()

			const result = await backfillMissingPeople(request, {
				accountId: TEST_ACCOUNT_ID,
				dryRun: true,
			})

			// Should report what would be done
			expect(result.peopleCreated).toBe(2)
			expect(result.linksCreated).toBe(2)
			expect(result.errors).toHaveLength(0)

			// But should not actually create anything
			const state = await getTestDbState()
			expect(state.people).toHaveLength(1) // No new people created
			expect(state.interviewPeopleLinks).toHaveLength(1) // No new links created
		})

		it("should handle database errors gracefully", async () => {
			const request = createTestRequest()

			// Create a scenario that will cause constraint violations
			// Use empty account ID to trigger validation errors

			const result = await backfillMissingPeople(request, {
				accountId: "", // This should cause validation issues
				dryRun: false,
			})

			// Should handle errors without crashing
			expect(result.errors.length).toBeGreaterThan(0)
			expect(result.peopleCreated).toBeLessThanOrEqual(result.interviewsWithoutPeople)
		})
	})

	describe("Junction Table Integration", () => {
		it("should maintain junction table relationships during backfill", async () => {
			const request = createTestRequest()

			// Verify initial junction table state
			const initialState = await getTestDbState()
			expect(initialState.insightTags).toHaveLength(3) // From seed data

			// Run backfill
			await backfillMissingPeople(request, {
				accountId: TEST_ACCOUNT_ID,
				dryRun: false,
			})

			// Verify junction tables are unaffected
			const finalState = await getTestDbState()
			expect(finalState.insightTags).toHaveLength(3) // Should be unchanged

			// Verify we can still query across junction tables
			const { data: insightsWithTags } = await testDb
				.from("insights")
				.select(`
          *,
          insight_tags (
            tag
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID)

			expect(insightsWithTags).toHaveLength(2)
			expect(insightsWithTags?.[0].insight_tags).toBeDefined()
		})
	})

	describe("RLS Policy Enforcement", () => {
		it("should respect account isolation in backfill operations", async () => {
			// Seed data for different account
			const OTHER_ACCOUNT_ID = "other-account-456"
			await testDb.from("interviews").insert({
				account_id: OTHER_ACCOUNT_ID,
				project_id: "other-project-1",
				title: "Other Account Interview",
				participant_pseudonym: "Other Person",
				segment: "other",
				interview_date: "2025-01-25",
				status: "ready",
			})

			const request = createTestRequest()

			// Run backfill for test account
			const result = await backfillMissingPeople(request, {
				accountId: TEST_ACCOUNT_ID,
				dryRun: false,
			})

			// Should only process interviews from test account
			expect(result.totalInterviews).toBe(3) // Only test account interviews

			// Verify other account's data is untouched
			const { data: otherAccountInterviews } = await testDb
				.from("interviews")
				.select("*")
				.eq("account_id", OTHER_ACCOUNT_ID)

			expect(otherAccountInterviews).toHaveLength(1)
			expect(otherAccountInterviews?.[0].id).toBe("other-interview-1")
		})
	})
})
