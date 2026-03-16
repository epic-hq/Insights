import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

function callQueueRpc(name: string, args?: Record<string, unknown>) {
	return testDb.rpc(name as never, args as never);
}

function requireRecord<T>(value: T | null, label: string): T {
	if (!value) {
		throw new Error(`Expected ${label} to be defined in test setup`);
	}
	return value;
}

/**
 * Integration tests for persona-insight relationships against normalized schema.
 * Uses people_personas junction (not people.persona_id).
 */
describe("Persona-Insight Integration Tests", () => {
	beforeEach(async () => {
		await cleanupTestData();
		await seedTestData();
	});

	it("should create persona-insight relationships when a linked person has a persona", async () => {
		const supabase = testDb;

		const interviewId = crypto.randomUUID();

		const { data: persona, error: personaError } = await supabase
			.from("personas")
			.insert({
				name: "Tech-Savvy User",
				description: "Users who are comfortable with technology",
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
			})
			.select()
			.single();
		expect(personaError).toBeNull();
		expect(persona).toBeTruthy();
		const createdPersona = requireRecord(persona, "persona");

		const { data: person, error: personError } = await supabase
			.from("people")
			.insert({
				firstname: "John",
				lastname: "Doe",
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
			})
			.select()
			.single();
		expect(personError).toBeNull();
		expect(person).toBeTruthy();
		const createdPerson = requireRecord(person, "person");

		const { error: interviewError } = await supabase.from("interviews").insert({
			id: interviewId,
			title: "User Research Session",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			status: "ready",
		});
		expect(interviewError).toBeNull();

		const { error: interviewPersonError } = await supabase.from("interview_people").insert({
			interview_id: interviewId,
			person_id: createdPerson.id,
		});
		expect(interviewPersonError).toBeNull();

		const { error: peoplePersonaError } = await supabase.from("people_personas").insert({
			interview_id: interviewId,
			person_id: createdPerson.id,
			persona_id: createdPersona.id,
			project_id: TEST_PROJECT_ID,
		});
		expect(peoplePersonaError).toBeNull();

		const { data: insight, error: insightError } = await supabase
			.from("themes")
			.insert({
				name: "Users prefer simple interfaces",
				category: "UX",
				interview_id: interviewId,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
			})
			.select()
			.single();
		expect(insightError).toBeNull();
		expect(insight).toBeTruthy();
		const createdInsight = requireRecord(insight, "insight");

		const { data: personaInsights, error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: createdInsight.id,
		});

		expect(error).toBeNull();
		expect(personaInsights).toBeDefined();

		const { data: junctionRecords, error: junctionError } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", createdInsight.id);

		expect(junctionError).toBeNull();
		expect(junctionRecords).toBeTruthy();
		expect(junctionRecords?.length).toBeGreaterThan(0);
		expect(junctionRecords?.[0].persona_id).toBe(createdPersona.id);
	});

	it("should handle people without persona links gracefully", async () => {
		const supabase = testDb;
		const interviewId = crypto.randomUUID();

		const { data: person, error: personError } = await supabase
			.from("people")
			.insert({
				firstname: "Jane",
				lastname: "Smith",
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
			})
			.select()
			.single();
		expect(personError).toBeNull();
		expect(person).toBeTruthy();
		const createdPerson = requireRecord(person, "person");

		const { error: interviewError } = await supabase.from("interviews").insert({
			id: interviewId,
			title: "Another Research Session",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			status: "ready",
		});
		expect(interviewError).toBeNull();

		const { error: interviewPersonError } = await supabase.from("interview_people").insert({
			interview_id: interviewId,
			person_id: createdPerson.id,
		});
		expect(interviewPersonError).toBeNull();

		const { data: insight, error: insightError } = await supabase
			.from("themes")
			.insert({
				name: "Users need better onboarding",
				category: "UX",
				interview_id: interviewId,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
			})
			.select()
			.single();
		expect(insightError).toBeNull();
		const createdInsight = requireRecord(insight, "insight");

		const { error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: createdInsight.id,
		});
		expect(error).toBeNull();

		const { data: junctionRecords, error: junctionError } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", createdInsight.id);

		expect(junctionError).toBeNull();
		expect(junctionRecords).toBeTruthy();
		expect(junctionRecords?.length).toBe(0);
	});

	it("should validate schema expectations for normalized persona links", async () => {
		const { data: peopleRows, error: peopleError } = await testDb.from("people").select("id").limit(1);
		expect(peopleError).toBeNull();
		expect(Array.isArray(peopleRows)).toBe(true);

		// people.persona_id no longer exists in normalized schema
		const { error: personaIdError } = await testDb.from("people").select("persona_id").limit(1);
		expect(personaIdError).toBeDefined();

		const { data: linkRows, error: linksError } = await testDb
			.from("people_personas")
			.select("person_id, persona_id")
			.limit(1);
		expect(linksError).toBeNull();
		expect(Array.isArray(linkRows)).toBe(true);
	});

	describe("embedding queue enqueue regressions", () => {
		afterAll(async () => {
			await cleanupTestData();
		});

		it("should enqueue insight embedding message in pgmq after themes insert", async () => {
			// Guards against enqueue_insight_embedding() SECURITY DEFINER regression.
			// Themes inserts fire trg_enqueue_insight → pgmq.q_insights_embedding_queue.
			// If prosecdef=false, service_role gets "permission denied" and theme embeddings
			// are silently never generated. Queue depth > 0 proves the trigger fired.
			const depthBefore = Number(
				(await callQueueRpc("get_insights_embedding_queue_depth", { filter_table: null })).data ?? 0
			);

			const { error } = await testDb.from("themes").insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				name: "Queue regression probe theme",
				pain: "Test pain to trigger enqueue",
				category: "pain_point",
			});
			expect(error).toBeNull();

			const { data: depthAfter, error: rpcError } = await callQueueRpc("get_insights_embedding_queue_depth", {
				filter_table: null,
			});
			expect(rpcError).toBeNull();
			expect(Number(depthAfter)).toBeGreaterThan(depthBefore);
		});
	});
});
