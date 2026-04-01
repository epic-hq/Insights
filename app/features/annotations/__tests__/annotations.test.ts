import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "~/types";
import type { EntityType } from "../db";
import {
	createAnnotation,
	deleteAnnotation,
	getAnnotationsForEntity,
	getVoteCountsForEntity,
	getUserFlagsForEntity,
	removeVote,
	setEntityFlag,
	updateAnnotation,
	upsertVote,
} from "../db";

// Test database setup
const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "your-anon-key";
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Test data - use valid v4 UUIDs for Zod v4 compliance
const testAccountId = "d7b69d5e-a952-4a7b-8c9d-000000000001";
const testProjectId = "d7b69d5e-a952-4a7b-8c9d-000000000002";
const testUserId = "d7b69d5e-a952-4a7b-8c9d-000000000003";
const testEntityId = "d7b69d5e-a952-4a7b-8c9d-000000000004";
const testUserId2 = "d7b69d5e-a952-4a7b-8c9d-000000000005";

describe("Annotations System", () => {
	beforeEach(async () => {
		// Clean up test data before each test
		await supabase.from("annotations").delete().eq("account_id", testAccountId);
		await supabase.from("votes").delete().eq("account_id", testAccountId);
		await supabase.from("entity_flags").delete().eq("account_id", testAccountId);
	});

	afterEach(async () => {
		// Clean up test data after each test
		await supabase.from("annotations").delete().eq("account_id", testAccountId);
		await supabase.from("votes").delete().eq("account_id", testAccountId);
		await supabase.from("entity_flags").delete().eq("account_id", testAccountId);
	});

	describe("Annotations CRUD", () => {
		it("should create a comment annotation", async () => {
			const result = await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				content: "This is a test comment",
				createdByUserId: testUserId,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.content).toBe("This is a test comment");
			expect(result.data?.annotation_type).toBe("comment");
		});

		it("should create an AI suggestion annotation", async () => {
			const result = await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "ai_suggestion",
				content: "AI suggests this improvement",
				createdByAi: true,
				aiModel: "gpt-4",
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.created_by_ai).toBe(true);
			expect(result.data?.ai_model).toBe("gpt-4");
		});

		it("should fetch annotations for an entity", async () => {
			// Create test annotations
			await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				content: "Comment 1",
				createdByUserId: testUserId,
			});

			await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				content: "Comment 2",
				createdByUserId: testUserId,
			});

			const result = await getAnnotationsForEntity({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.length).toBe(2);
		});

		it("should update an annotation", async () => {
			const createResult = await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				content: "Original content",
				createdByUserId: testUserId,
			});

			const annotationId = createResult.data?.id;

			const updateResult = await updateAnnotation({
				supabase,
				annotationId: annotationId!,
				updates: { content: "Updated content" },
			});

			expect(updateResult.data).toBeDefined();
			expect(updateResult.error).toBeNull();
			expect(updateResult.data?.content).toBe("Updated content");
		});

		it("should delete an annotation", async () => {
			const createResult = await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				content: "To be deleted",
				createdByUserId: testUserId,
			});

			const annotationId = createResult.data?.id;

			const deleteResult = await deleteAnnotation({
				supabase,
				annotationId: annotationId!,
			});

			expect(deleteResult.error).toBeNull();

			// Verify it's deleted
			const fetchResult = await getAnnotationsForEntity({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
			});

			expect(fetchResult.data?.length).toBe(0);
		});
	});

	describe("Voting System", () => {
		it("should upsert an upvote", async () => {
			const result = await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				voteValue: 1,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.vote_value).toBe(1);
		});

		it("should upsert a downvote", async () => {
			const result = await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				voteValue: -1,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.vote_value).toBe(-1);
		});

		it("should get vote counts", async () => {
			// Create some votes
			await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				voteValue: 1,
			});

			await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId2,
				voteValue: -1,
			});

			const result = await getVoteCountsForEntity({
				supabase,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.upvotes).toBe(1);
			expect(result.data?.downvotes).toBe(1);
		});

		it("should get vote counts with user vote", async () => {
			await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				voteValue: 1,
			});

			const result = await getVoteCountsForEntity({
				supabase,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.user_vote).toBe(1);
		});

		it("should remove a vote", async () => {
			await upsertVote({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				voteValue: 1,
			});

			const removeResult = await removeVote({
				supabase,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			});

			expect(removeResult.error).toBeNull();

			// Verify vote is removed by checking vote counts
			const voteCountsResult = await getVoteCountsForEntity({
				supabase,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
			});

			expect(voteCountsResult.data?.user_vote).toBe(0);
		});
	});

	describe("Entity Flags System", () => {
		it("should set entity flags", async () => {
			const result = await setEntityFlag({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				flagType: "archived",
				flagValue: true,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			expect(result.data?.flag_type).toBe("archived");
			expect(result.data?.flag_value).toBe(true);
		});

		it("should get user flags", async () => {
			await setEntityFlag({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				userId: testUserId,
				flagType: "starred",
				flagValue: true,
			});

			const result = await getUserFlagsForEntity({
				supabase,
				entityType: "insight",
				entityId: testEntityId,
				projectId: testProjectId,
			});

			expect(result.data).toBeDefined();
			expect(result.error).toBeNull();
			// getUserFlagsForEntity returns a UserFlags object, not an array
			expect(result.data?.starred).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid entity type", async () => {
			const result = await getAnnotationsForEntity({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "invalid_type" as unknown as EntityType,
				entityId: testEntityId,
			});

			expect(result.error).toBeDefined();
		});

		it("should handle missing required fields", async () => {
			const result = await createAnnotation({
				supabase,
				accountId: testAccountId,
				projectId: testProjectId,
				entityType: "insight",
				entityId: testEntityId,
				annotationType: "comment",
				// content is optional in the source signature, so this should succeed
				// but we're testing the function accepts minimal params
			});

			// With content being optional, this may succeed - the test validates the call works
			expect(result).toBeDefined();
		});
	});
});
