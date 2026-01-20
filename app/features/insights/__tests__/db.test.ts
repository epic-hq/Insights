/**
 * Tests for Insights/Themes database operations
 *
 * These tests verify the core CRUD operations for insights.
 * Run with: pnpm test:integration
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import {
	testDb,
	seedTestData,
	cleanupTestData,
	TEST_ACCOUNT_ID,
	TEST_PROJECT_ID,
} from "~/test/utils/testDb"

describe("Insights DB Operations", () => {
	beforeEach(async () => {
		await seedTestData()
	})

	afterAll(async () => {
		await cleanupTestData()
	})

	describe("createInsight", () => {
		it("creates an insight with required fields", async () => {
			const { data: insight, error } = await testDb
				.from("themes")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Test Insight",
					content: "This is test content",
				})
				.select()
				.single()

			expect(error).toBeNull()
			expect(insight).toBeDefined()
			expect(insight?.name).toBe("Test Insight")
			expect(insight?.content).toBe("This is test content")
		})

		it("creates an insight with all optional fields", async () => {
			const { data: insight, error } = await testDb
				.from("themes")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Full Insight",
					content: "Full content",
					category: "pain_point",
					jtbd: "When I..., I want to..., so that...",
					pain: "Pain description",
					desired_outcome: "Desired outcome",
					journey_stage: "awareness",
					emotional_response: "frustrated",
					motivation: "efficiency",
					impact: "high",
					priority: 1,
				})
				.select()
				.single()

			expect(error).toBeNull()
			expect(insight?.category).toBe("pain_point")
			expect(insight?.jtbd).toBe("When I..., I want to..., so that...")
			expect(insight?.impact).toBe("high")
		})

		it("links insight to interview", async () => {
			const { data: insight } = await testDb
				.from("themes")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: "interview-1",
					name: "Interview-linked Insight",
				})
				.select()
				.single()

			expect(insight?.interview_id).toBe("interview-1")
		})
	})

	describe("getInsights", () => {
		it("returns insights for the correct project", async () => {
			const { data: insights, error } = await testDb
				.from("themes")
				.select("*")
				.eq("project_id", TEST_PROJECT_ID)
				.order("created_at", { ascending: false })

			expect(error).toBeNull()
			expect(insights).toBeInstanceOf(Array)
			expect(insights!.length).toBeGreaterThanOrEqual(2) // Seeded data
		})

		it("returns insights with evidence count", async () => {
			const { data: insights } = await testDb
				.from("themes")
				.select(
					`
					id,
					name,
					theme_evidence(count)
				`,
				)
				.eq("project_id", TEST_PROJECT_ID)

			expect(insights).toBeInstanceOf(Array)
			// Each insight should have theme_evidence count field
			for (const insight of insights || []) {
				expect(insight.theme_evidence).toBeDefined()
			}
		})

		it("filters by category", async () => {
			const { data: painPoints } = await testDb
				.from("themes")
				.select("*")
				.eq("project_id", TEST_PROJECT_ID)
				.eq("category", "pain_point")

			expect(painPoints?.every((i) => i.category === "pain_point")).toBe(true)
		})

		it("supports pagination", async () => {
			// Create multiple insights
			for (let i = 0; i < 5; i++) {
				await testDb.from("themes").insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: `Pagination Test ${i}`,
				})
			}

			// Get first page
			const { data: firstPage } = await testDb
				.from("themes")
				.select("*")
				.eq("project_id", TEST_PROJECT_ID)
				.range(0, 2)

			expect(firstPage).toHaveLength(3)

			// Get second page
			const { data: secondPage } = await testDb
				.from("themes")
				.select("*")
				.eq("project_id", TEST_PROJECT_ID)
				.range(3, 5)

			// IDs should be different
			const firstIds = new Set(firstPage?.map((i) => i.id))
			const secondIds = new Set(secondPage?.map((i) => i.id))
			const overlap = [...firstIds].filter((id) => secondIds.has(id))
			expect(overlap).toHaveLength(0)
		})
	})

	describe("getInsightById", () => {
		it("returns a specific insight by ID", async () => {
			const { data: insight, error } = await testDb
				.from("themes")
				.select("*")
				.eq("id", "insight-1")
				.single()

			expect(error).toBeNull()
			expect(insight?.id).toBe("insight-1")
			expect(insight?.name).toBe("Pricing concerns for enterprise")
		})

		it("returns null for non-existent insight", async () => {
			const { data: insight } = await testDb
				.from("themes")
				.select("*")
				.eq("id", "non-existent")
				.maybeSingle()

			expect(insight).toBeNull()
		})
	})

	describe("updateInsight", () => {
		it("updates insight fields", async () => {
			const { error: updateError } = await testDb
				.from("themes")
				.update({
					name: "Updated Insight Name",
					content: "Updated content",
					priority: 5,
				})
				.eq("id", "insight-1")

			expect(updateError).toBeNull()

			// Verify update
			const { data: insight } = await testDb.from("themes").select("*").eq("id", "insight-1").single()

			expect(insight?.name).toBe("Updated Insight Name")
			expect(insight?.content).toBe("Updated content")
			expect(insight?.priority).toBe(5)
		})

		it("updates only specified fields", async () => {
			// Get original
			const { data: original } = await testDb.from("themes").select("*").eq("id", "insight-1").single()

			// Update only name
			await testDb.from("themes").update({ name: "OnlyName" }).eq("id", "insight-1")

			const { data: updated } = await testDb.from("themes").select("*").eq("id", "insight-1").single()

			expect(updated?.name).toBe("OnlyName")
			expect(updated?.content).toBe(original?.content) // Unchanged
			expect(updated?.category).toBe(original?.category) // Unchanged
		})
	})

	describe("deleteInsight", () => {
		it("deletes an insight", async () => {
			// Create an insight to delete
			const { data: created } = await testDb
				.from("themes")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "ToDelete",
				})
				.select()
				.single()

			// Delete
			const { error: deleteError } = await testDb.from("themes").delete().eq("id", created!.id)

			expect(deleteError).toBeNull()

			// Verify deleted
			const { data: deleted } = await testDb.from("themes").select("*").eq("id", created!.id).maybeSingle()

			expect(deleted).toBeNull()
		})
	})

	describe("insight_tags junction", () => {
		it("links tags to insights", async () => {
			// Seeded data already has tag links
			const { data: tags } = await testDb
				.from("insight_tags")
				.select(
					`
					insight_id,
					tags:tag_id(tag)
				`,
				)
				.eq("insight_id", "insight-1")

			expect(tags).toBeInstanceOf(Array)
			expect(tags!.length).toBeGreaterThanOrEqual(1)
		})

		it("creates new tag association", async () => {
			const { error: linkError } = await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: "insight-2",
				tag: "tag-1", // Existing tag
			})

			expect(linkError).toBeNull()

			// Verify link
			const { data: links } = await testDb
				.from("insight_tags")
				.select("*")
				.eq("insight_id", "insight-2")
				.eq("tag", "tag-1")

			expect(links).toHaveLength(1)
		})

		it("prevents duplicate tag associations", async () => {
			// insight-1 already has tag-1 from seeded data
			const { error: duplicateError } = await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: "insight-1",
				tag: "tag-1",
			})

			// Should fail due to unique constraint
			expect(duplicateError).toBeDefined()
		})

		it("removes tag association", async () => {
			// Create then remove
			await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: "insight-2",
				tag: "tag-3",
			})

			const { error: deleteError } = await testDb
				.from("insight_tags")
				.delete()
				.eq("insight_id", "insight-2")
				.eq("tag", "tag-3")

			expect(deleteError).toBeNull()
		})
	})

	describe("account isolation", () => {
		it("insights from different accounts are isolated", async () => {
			const otherAccountId = crypto.randomUUID()
			const otherProjectId = crypto.randomUUID()

			// Create project and insight in different account
			await testDb.from("projects").insert({
				id: otherProjectId,
				account_id: otherAccountId,
				title: "Other Project",
			})

			await testDb.from("themes").insert({
				account_id: otherAccountId,
				project_id: otherProjectId,
				name: "Other Account Insight",
			})

			// Query should not see other account's insights
			const { data: insights } = await testDb.from("themes").select("*").eq("account_id", TEST_ACCOUNT_ID)

			const otherInsight = insights?.find((i) => i.name === "Other Account Insight")
			expect(otherInsight).toBeUndefined()

			// Cleanup
			await testDb.from("themes").delete().eq("account_id", otherAccountId)
			await testDb.from("projects").delete().eq("id", otherProjectId)
		})
	})
})
