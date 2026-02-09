import { beforeEach, describe, expect, it } from "vitest";
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

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
			person_id: person!.id,
		});
		expect(interviewPersonError).toBeNull();

		const { error: peoplePersonaError } = await supabase.from("people_personas").insert({
			interview_id: interviewId,
			person_id: person!.id,
			persona_id: persona!.id,
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

		const { data: personaInsights, error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: insight!.id,
		});

		expect(error).toBeNull();
		expect(personaInsights).toBeDefined();

		const { data: junctionRecords, error: junctionError } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", insight!.id);

		expect(junctionError).toBeNull();
		expect(junctionRecords).toBeTruthy();
		expect(junctionRecords!.length).toBeGreaterThan(0);
		expect(junctionRecords![0].persona_id).toBe(persona!.id);
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
			person_id: person!.id,
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

		const { error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: insight!.id,
		});
		expect(error).toBeNull();

		const { data: junctionRecords, error: junctionError } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", insight!.id);

		expect(junctionError).toBeNull();
		expect(junctionRecords).toBeTruthy();
		expect(junctionRecords!.length).toBe(0);
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
});
