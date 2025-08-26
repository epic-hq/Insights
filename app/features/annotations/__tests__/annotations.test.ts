import { createClient } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Database } from "~/types"
import {
	createAnnotation,
	deleteAnnotation,
	getAnnotationCounts,
	getAnnotations,
	getUserFlags,
	getUserVote,
	getVoteCounts,
	removeVote,
	setEntityFlag,
	updateAnnotation,
	upsertVote,
} from "../db"

// Test database setup
const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
const supabaseKey = process.env.SUPABASE_ANON_KEY || "your-anon-key"
const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Test data
const testAccountId = "00000000-0000-0000-0000-000000000001"
const testProjectId = "00000000-0000-0000-0000-000000000002"
const testUserId = "00000000-0000-0000-0000-000000000003"
const testEntityId = "00000000-0000-0000-0000-000000000004"

describe("Annotations System", () => {
	beforeEach(async () => {
		// Clean up test data before each test
		await supabase.from("annotations").delete().eq("account_id", testAccountId)
		await supabase.from("votes").delete().eq("account_id", testAccountId)
		await supabase.from("entity_flags").delete().eq("account_id", testAccountId)
	})

	afterEach(async () => {
		// Clean up test data after each test
		await supabase.from("annotations").delete().eq("account_id", testAccountId)
		await supabase.from("votes").delete().eq("account_id", testAccountId)
		await supabase.from("entity_flags").delete().eq("account_id", testAccountId)
	})

	describe("Annotations CRUD", () => {
		it("should create a comment annotation", async () => {
			const annotationData = {
				account_id: testAccountId,
				project_id: testProjectId,
				entity_type: "insight" as const,
				entity_id: testEntityId,
				annotation_type: "comment" as const,
				content: "This is a test comment",
				created_by_user_id: testUserId,
			}

			const result = await createAnnotation({ supabase, data: annotationData })

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.content).toBe("This is a test comment")
			expect(result.data?.annotation_type).toBe("comment")
		})

		it("should create an AI suggestion annotation", async () => {
			const annotationData = {
				account_id: testAccountId,
				project_id: testProjectId,
				entity_type: "insight" as const,
				entity_id: testEntityId,
				annotation_type: "ai_suggestion" as const,
				content: "AI suggests this improvement",
				created_by_ai: true,
				ai_model: "gpt-4",
			}

			const result = await createAnnotation({ supabase, data: annotationData })

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.created_by_ai).toBe(true)
			expect(result.data?.ai_model).toBe("gpt-4")
		})

		it("should fetch annotations for an entity", async () => {
			// Create test annotations
			await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					content: "Comment 1",
					created_by_user_id: testUserId,
				},
			})

			await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					content: "Comment 2",
					created_by_user_id: testUserId,
				},
			})

			const result = await getAnnotations({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.length).toBe(2)
		})

		it("should update an annotation", async () => {
			const createResult = await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					content: "Original content",
					created_by_user_id: testUserId,
				},
			})

			const annotationId = createResult.data?.id

			const updateResult = await updateAnnotation({
				supabase,
				id: annotationId,
				accountId: testAccountId,
				data: { content: "Updated content" },
			})

			expect(updateResult.data).toBeDefined()
			expect(updateResult.error).toBeNull()
			expect(updateResult.data?.content).toBe("Updated content")
		})

		it("should delete an annotation", async () => {
			const createResult = await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					content: "To be deleted",
					created_by_user_id: testUserId,
				},
			})

			const annotationId = createResult.data?.id

			const deleteResult = await deleteAnnotation({
				supabase,
				id: annotationId,
				accountId: testAccountId,
			})

			expect(deleteResult.error).toBeNull()

			// Verify it's deleted
			const fetchResult = await getAnnotations({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
			})

			expect(fetchResult.data?.length).toBe(0)
		})
	})

	describe("Voting System", () => {
		it("should upsert an upvote", async () => {
			const result = await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					vote_value: 1,
				},
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.vote_value).toBe(1)
		})

		it("should upsert a downvote", async () => {
			const result = await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					vote_value: -1,
				},
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.vote_value).toBe(-1)
		})

		it("should get vote counts", async () => {
			// Create some votes
			await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					vote_value: 1,
				},
			})

			await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: "00000000-0000-0000-0000-000000000005",
					vote_value: -1,
				},
			})

			const result = await getVoteCounts({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.upvotes).toBe(1)
			expect(result.data?.downvotes).toBe(1)
		})

		it("should get user vote", async () => {
			await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					vote_value: 1,
				},
			})

			const result = await getUserVote({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.vote_value).toBe(1)
		})

		it("should remove a vote", async () => {
			await upsertVote({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					vote_value: 1,
				},
			})

			const removeResult = await removeVote({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			})

			expect(removeResult.error).toBeNull()

			// Verify it's removed
			const getUserVoteResult = await getUserVote({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			})

			expect(getUserVoteResult.data).toBeNull()
		})
	})

	describe("Entity Flags System", () => {
		it("should set entity flags", async () => {
			const result = await setEntityFlag({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					flag_type: "archived",
					flag_value: true,
				},
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.flag_type).toBe("archived")
			expect(result.data?.flag_value).toBe(true)
		})

		it("should get user flags", async () => {
			await setEntityFlag({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					user_id: testUserId,
					flag_type: "starred",
					flag_value: true,
				},
			})

			const result = await getUserFlags({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.length).toBe(1)
			expect(result.data?.[0].flag_type).toBe("starred")
		})
	})

	describe("Aggregation Functions", () => {
		it("should get annotation counts", async () => {
			// Create test annotations
			await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					content: "Comment 1",
					created_by_user_id: testUserId,
				},
			})

			await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "ai_suggestion",
					content: "AI suggestion",
					created_by_ai: true,
				},
			})

			const result = await getAnnotationCounts({
				supabase,
				accountId: testAccountId,
				entityType: "insight",
				entityId: testEntityId,
			})

			expect(result.data).toBeDefined()
			expect(result.error).toBeNull()
			expect(result.data?.total_count).toBe(2)
			expect(result.data?.comment_count).toBe(1)
			expect(result.data?.ai_suggestion_count).toBe(1)
		})
	})

	describe("Error Handling", () => {
		it("should handle invalid entity type", async () => {
			const result = await getAnnotations({
				supabase,
				accountId: testAccountId,
				entityType: "invalid_type" as any,
				entityId: testEntityId,
			})

			expect(result.error).toBeDefined()
		})

		it("should handle missing required fields", async () => {
			const result = await createAnnotation({
				supabase,
				data: {
					account_id: testAccountId,
					project_id: testProjectId,
					entity_type: "insight",
					entity_id: testEntityId,
					annotation_type: "comment",
					// Missing content
				} as any,
			})

			expect(result.error).toBeDefined()
		})
	})
})
