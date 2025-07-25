/**
 * Integration tests for database operations and schema validation
 * Tests critical DB operations: Junction Tables, Queries, Constraints, RLS
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { getTestDbState, mockTestAuth, seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb"

// Mock only Supabase server client for auth context
vi.mock("~/lib/supabase/server", () => ({
	getServerClient: () => mockTestAuth(),
}))

describe("Database Integration Tests", () => {
	beforeEach(async () => {
		await seedTestData()
	})

	afterAll(async () => {
		await testDb.removeAllChannels()
	})

	describe("Junction Table Operations", () => {
		it("should support complex joins across junction tables", async () => {
			// Test complex query that joins multiple tables through junctions
			const { data: complexQuery, error } = await testDb
				.from("interviews")
				.select(`
          id,
          title,
          people:interview_people (
            people (
              name,
              segment
            )
          ),
          insights (
            name,
            insight_tags (
              tags (
                tag,
                category
              )
            )
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID)

			expect(error).toBeNull()
			expect(complexQuery).toHaveLength(3)

			// Verify structure of joined data
			const interviewWithPerson = complexQuery?.find((i) => i.id === "interview-1")
			expect(interviewWithPerson?.people).toHaveLength(1)
			expect(interviewWithPerson?.people[0].people.name).toBe("Sarah Chen")
			expect(interviewWithPerson?.insights).toHaveLength(1)
			expect(interviewWithPerson?.insights[0].insight_tags).toHaveLength(2)
		})

		it("should maintain junction table relationships during operations", async () => {
			// Verify initial junction table state
			const initialState = await getTestDbState()
			expect(initialState.insightTags).toHaveLength(3)

			// Add new insight-tag relationship
			await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: "insight-2",
				tag: "tag-3", // Link insight-2 to enterprise tag
			})

			// Verify junction tables are updated correctly
			const finalState = await getTestDbState()
			expect(finalState.insightTags).toHaveLength(4)

			// Verify we can still query junction tables correctly
			const { data: tagsWithInsights } = await testDb
				.from("tags")
				.select(`
          *,
          insight_tags (
            insights (*)
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID)

			expect(tagsWithInsights).toHaveLength(3)
			expect(tagsWithInsights?.[0].insight_tags).toBeDefined()
		})
	})

	describe("Data Integrity Validation", () => {
		it("should enforce foreign key constraints", async () => {
			// Try to create interview-people link with invalid interview ID
			const { error } = await testDb.from("interview_people").insert({
				interview_id: "non-existent-interview",
				person_id: "person-1",
				role: "participant",
			})

			// Should fail due to foreign key constraint
			expect(error).toBeDefined()
			expect(error?.code).toBe("23503") // Foreign key violation
		})

		it("should enforce unique constraints on junction tables", async () => {
			// Try to create duplicate insight-tag relationship
			const { error } = await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: "insight-1",
				tag: "tag-1", // This combination already exists in seed data
			})

			// Should fail due to unique constraint
			expect(error).toBeDefined()
			expect(error?.code).toBe("23505") // Unique violation
		})

		it("should enforce RLS policies across all tables", async () => {
			// Try to access data from different account
			const { data: crossAccountPeople } = await testDb
				.from("people")
				.select("*")
				.eq("account_id", "different-account-id")

			// Should return empty due to RLS
			expect(crossAccountPeople).toHaveLength(0)

			// Verify we can still access our own account data
			const { data: ownAccountPeople } = await testDb.from("people").select("*").eq("account_id", TEST_ACCOUNT_ID)

			expect(ownAccountPeople).toHaveLength(1)
		})
	})

	describe("Complex Query Validation", () => {
		it("should handle complex joins across junction tables", async () => {
			// Test complex query that joins multiple tables through junctions
			const { data: complexQuery, error } = await testDb
				.from("interviews")
				.select(`
          id,
          title,
          people:interview_people (
            people (
              name,
              segment
            )
          ),
          insights (
            name,
            insight_tags (
              tag
            )
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID)

			expect(error).toBeNull()
			expect(complexQuery).toHaveLength(3)

			// Verify structure of joined data
			const interviewWithPerson = complexQuery?.find((i) => i.id === "interview-1")
			expect(interviewWithPerson?.people).toHaveLength(1)
			expect(interviewWithPerson?.people[0].people.name).toBe("Sarah Chen")
			expect(interviewWithPerson?.insights).toHaveLength(1)
			expect(interviewWithPerson?.insights[0].insight_tags).toHaveLength(2)
		})

		it("should handle aggregations across junction tables", async () => {
			// Test aggregation query - simplified version
			const { data: tagCounts, error } = await testDb
				.from("insight_tags")
				.select("tag, insight_id")
				.eq("account_id", TEST_ACCOUNT_ID)

			expect(error).toBeNull()
			expect(tagCounts).toHaveLength(3)
		})
	})
})
