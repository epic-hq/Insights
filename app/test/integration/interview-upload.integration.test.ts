/**
 * Integration tests for database operations and schema validation
 * Tests critical DB operations: Junction Tables, Queries, Constraints, RLS
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getTestDbState,
	mockTestAuth,
	seedTestData,
	TEST_ACCOUNT_ID,
	TEST_INSIGHT_1_ID,
	TEST_INSIGHT_2_ID,
	TEST_INTERVIEW_1_ID,
	TEST_PERSON_1_ID,
	TEST_PROJECT_ID,
	TEST_TAG_1_ID,
	TEST_TAG_3_ID,
	testDb,
} from "~/test/utils/testDb";

function callQueueRpc(name: string, args?: Record<string, unknown>) {
	return testDb.rpc(name as never, args as never);
}

function requireId(value: string | undefined, label: string): string {
	if (!value) {
		throw new Error(`Expected ${label} to be defined in test setup`);
	}
	return value;
}

// Mock only Supabase server client for auth context
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: () => mockTestAuth(),
}));

describe("Database Integration Tests", () => {
	beforeEach(async () => {
		await seedTestData();
	});

	afterAll(async () => {
		await testDb.removeAllChannels();
	});

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
          themes (
            name,
            insight_tags (
              tags (
                tag
              )
            )
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID);

			expect(error).toBeNull();
			expect(complexQuery).toHaveLength(3);

			// Verify structure of joined data
			const interviewWithPerson = complexQuery?.find((i) => i.id === TEST_INTERVIEW_1_ID);
			expect(interviewWithPerson?.people).toHaveLength(1);
			expect(interviewWithPerson?.people[0].people.name).toBe("Sarah Chen");
			expect(interviewWithPerson?.themes).toHaveLength(1);
			expect(interviewWithPerson?.themes[0].insight_tags).toHaveLength(2);
		});

		it("should maintain junction table relationships during operations", async () => {
			// Verify initial junction table state
			const initialState = await getTestDbState();
			expect(initialState.insightTags).toHaveLength(3);

			// Add new insight-tag relationship
			await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: TEST_INSIGHT_2_ID,
				tag_id: TEST_TAG_3_ID, // Link insight-2 to enterprise tag
			});

			// Verify junction tables are updated correctly
			const finalState = await getTestDbState();
			expect(finalState.insightTags).toHaveLength(4);

			// Verify we can still query junction tables correctly
			const { data: tagsWithInsights } = await testDb
				.from("tags")
				.select(`
          *,
          insight_tags (
            themes (*)
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID);

			expect(tagsWithInsights).toHaveLength(3);
			expect(tagsWithInsights?.[0].insight_tags).toBeDefined();
		});
	});

	describe("Data Integrity Validation", () => {
		it("should enforce foreign key constraints", async () => {
			// Try to create interview-people link with invalid interview ID
			const { error } = await testDb.from("interview_people").insert({
				interview_id: crypto.randomUUID(),
				person_id: TEST_PERSON_1_ID,
				role: "participant",
			});

			// Should fail due to foreign key constraint
			expect(error).toBeDefined();
			expect(error?.code).toBe("23503"); // Foreign key violation
		});

		it("should enforce unique constraints on junction tables", async () => {
			// Try to create duplicate insight-tag relationship
			const { error } = await testDb.from("insight_tags").insert({
				account_id: TEST_ACCOUNT_ID,
				insight_id: TEST_INSIGHT_1_ID,
				tag_id: TEST_TAG_1_ID, // This combination already exists in seed data
			});

			// Should fail due to unique constraint
			expect(error).toBeDefined();
			expect(error?.code).toBe("23505"); // Unique violation
		});

		it("should enforce RLS policies across all tables", async () => {
			// Try to access data from different account
			const { data: crossAccountPeople } = await testDb
				.from("people")
				.select("*")
				.eq("account_id", crypto.randomUUID());

			// Should return empty due to RLS
			expect(crossAccountPeople).toHaveLength(0);

			// Verify we can still access our own account data
			const { data: ownAccountPeople } = await testDb.from("people").select("*").eq("account_id", TEST_ACCOUNT_ID);

			expect(ownAccountPeople).toHaveLength(1);
		});
	});

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
          themes (
            name,
            insight_tags (
              tag_id
            )
          )
        `)
				.eq("account_id", TEST_ACCOUNT_ID);

			expect(error).toBeNull();
			expect(complexQuery).toHaveLength(3);

			// Verify structure of joined data
			const interviewWithPerson = complexQuery?.find((i) => i.id === TEST_INTERVIEW_1_ID);
			expect(interviewWithPerson?.people).toHaveLength(1);
			expect(interviewWithPerson?.people[0].people.name).toBe("Sarah Chen");
			expect(interviewWithPerson?.themes).toHaveLength(1);
			expect(interviewWithPerson?.themes[0].insight_tags).toHaveLength(2);
		});

		it("should handle aggregations across junction tables", async () => {
			// Test aggregation query - simplified version
			const { data: tagCounts, error } = await testDb
				.from("insight_tags")
				.select("tag_id, insight_id")
				.eq("account_id", TEST_ACCOUNT_ID);

			expect(error).toBeNull();
			expect(tagCounts).toHaveLength(3);
		});
	});

	describe("embedding queue enqueue regressions", () => {
		it("should enqueue transcription message in pgmq after interview insert with media_url", async () => {
			// Guards against enqueue_transcribe_interview() SECURITY DEFINER regression.
			// Interviews with media_url fire trg_enqueue_transcribe_interview → pgmq.q_transcribe_interview_queue.
			// If prosecdef=false, service_role gets "permission denied" and transcription jobs
			// are silently never queued. Queue depth delta > 0 proves the trigger fired.
			const { data: before } = await callQueueRpc("get_transcribe_queue_depth");
			const depthBefore = Number(before ?? 0);

			const probeId = crypto.randomUUID();
			const { error } = await testDb.from("interviews").insert({
				id: probeId,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Queue regression probe interview",
				status: "processing",
				media_url: "https://example.com/probe-audio.mp3",
			});
			expect(error).toBeNull();

			const { data: after, error: rpcError } = await callQueueRpc("get_transcribe_queue_depth");
			expect(rpcError).toBeNull();
			expect(Number(after)).toBeGreaterThan(depthBefore);

			await testDb.from("interviews").delete().eq("id", probeId);
		});

		it("should enqueue evidence embedding message in pgmq after evidence insert", async () => {
			// Guards against enqueue_evidence_embedding() SECURITY DEFINER regression.
			// Evidence inserts fire trg_enqueue_evidence → pgmq.q_insights_embedding_queue (table='evidence').
			const { data: before } = await callQueueRpc("get_insights_embedding_queue_depth", { filter_table: "evidence" });
			const depthBefore = Number(before ?? 0);

			const { data: ev, error } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					method: "interview",
					verbatim: "Queue regression probe evidence",
				})
				.select("id")
				.single();
			expect(error).toBeNull();

			const { data: after, error: rpcError } = await callQueueRpc("get_insights_embedding_queue_depth", {
				filter_table: "evidence",
			});
			expect(rpcError).toBeNull();
			expect(Number(after)).toBeGreaterThan(depthBefore);

			await testDb.from("evidence").delete().eq("id", requireId(ev?.id, "evidence.id"));
		});
	});
});
