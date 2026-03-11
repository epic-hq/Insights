/**
 * Integration tests for person_facet embedding queue enqueue regression.
 * Guards against enqueue_person_facet_embedding() SECURITY DEFINER regression:
 * if prosecdef=false, service_role gets "permission denied for table q_person_facet_embedding_queue"
 * and person facet embeddings are silently never generated.
 *
 * Run: dotenvx run -f .env.staging -- pnpm vitest run app/test/integration/person-facet-queue.integration.test.ts
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { seedTestData, TEST_ACCOUNT_ID, TEST_PERSON_1_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

describe("Person Facet Embedding Queue Enqueue Regressions", () => {
	let facetAccountId: number;
	const cleanupFacetAccountIds: number[] = [];

	beforeAll(async () => {
		await seedTestData();

		// Look up a valid facet_kind_global id to use for facet_account creation
		const { data: kindRow, error: kindError } = await testDb
			.from("facet_kind_global")
			.select("id")
			.limit(1)
			.single();
		if (kindError || !kindRow) throw new Error(`No facet_kind_global rows found: ${kindError?.message}`);

		// Create a facet_account to reference from person_facet
		const { data: fa, error: faError } = await testDb
			.from("facet_account")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				kind_id: kindRow.id,
				slug: `queue-probe-${Date.now()}`,
				label: "Queue Probe Facet",
			})
			.select("id")
			.single();
		if (faError || !fa) throw new Error(`Failed to create facet_account: ${faError?.message}`);

		facetAccountId = fa.id;
		cleanupFacetAccountIds.push(fa.id);
	}, 20000);

	afterEach(async () => {
		// Clean up any person_facet rows inserted during tests
		await testDb.from("person_facet").delete().eq("facet_account_id", facetAccountId);
	});

	it("should enqueue person facet embedding message in pgmq after person_facet insert", async () => {
		// Guards against enqueue_person_facet_embedding() SECURITY DEFINER regression.
		// person_facet inserts with embedding=null fire trg_enqueue_person_facet
		// → pgmq.q_person_facet_embedding_queue.
		// If prosecdef=false, service_role gets "permission denied" and person facet
		// embeddings are silently never generated.
		const { data: before, error: beforeError } = await testDb.rpc("get_person_facet_embedding_queue_depth");
		expect(beforeError).toBeNull();
		const depthBefore = Number(before ?? 0);

		const { error } = await testDb.from("person_facet").insert({
			person_id: TEST_PERSON_1_ID,
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			facet_account_id: facetAccountId,
			source: "manual",
			// embedding intentionally omitted (null) to trigger the enqueue condition
		});
		expect(error).toBeNull();

		const { data: after, error: rpcError } = await testDb.rpc("get_person_facet_embedding_queue_depth");
		expect(rpcError).toBeNull();
		expect(Number(after)).toBeGreaterThan(depthBefore);
	});

	it("should NOT enqueue when person_facet is inserted with an existing embedding", async () => {
		// Verifies the trigger guard: embedding already set means no re-enqueue needed.
		const { data: before } = await testDb.rpc("get_person_facet_embedding_queue_depth");
		const depthBefore = Number(before ?? 0);

		// Use a different slug to avoid pk conflict
		const { data: fa2, error: fa2Error } = await testDb
			.from("facet_account")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				kind_id: (await testDb.from("facet_kind_global").select("id").limit(1).single()).data!.id,
				slug: `queue-probe-embed-${Date.now()}`,
				label: "Queue Probe Facet With Embedding",
			})
			.select("id")
			.single();
		if (fa2Error || !fa2) throw new Error(`Failed to create facet_account: ${fa2Error?.message}`);
		cleanupFacetAccountIds.push(fa2.id);

		const fakeEmbedding = Array(1536).fill(0.01);
		const { error } = await testDb.from("person_facet").insert({
			person_id: TEST_PERSON_1_ID,
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			facet_account_id: fa2.id,
			source: "manual",
			embedding: JSON.stringify(fakeEmbedding) as unknown as string,
		});
		expect(error).toBeNull();

		const { data: after } = await testDb.rpc("get_person_facet_embedding_queue_depth");
		// Depth should be unchanged — trigger should not fire when embedding is already set
		expect(Number(after)).toBe(depthBefore);

		await testDb.from("person_facet").delete().eq("facet_account_id", fa2.id);
		await testDb.from("facet_account").delete().eq("id", fa2.id);
	});
});
