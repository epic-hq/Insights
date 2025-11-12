import { beforeEach, describe, expect, it } from "vitest"
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb"

/**
 * Integration tests for persona-insight relationships and junction tables
 * This test should have caught the `pe.persona` column error
 */
describe("Persona-Insight Integration Tests", () => {
	beforeEach(async () => {
		await cleanupTestData()
		await seedTestData()
	})

	it("should create persona-insight relationships when insights are created", async () => {
		// Use direct testDb client with basic primitives
		const supabase = testDb

		// 1. Create a person with a persona
		const { data: persona } = await supabase
			.from("personas")
			.insert({
				name: "Tech-Savvy User",
				description: "Users who are comfortable with technology",
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		expect(persona).toBeTruthy()

		const { data: person } = await supabase
			.from("people")
			.insert({
				name: "John Doe",
				persona_id: persona.id,
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		expect(person).toBeTruthy()
		expect(person.persona_id).toBe(persona.id)

		// 2. Create an interview
		const { data: interview } = await supabase
			.from("interviews")
			.insert({
				title: "User Research Session",
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		expect(interview).toBeTruthy()

		// 3. Link person to interview
		await supabase.from("interview_people").insert({
			interview_id: interview.id,
			person_id: person.id,
			account_id: TEST_ACCOUNT_ID,
		})

		// 4. Create an insight
		const { data: insight } = await supabase
			.from("themes")
			.insert({
				name: "Users prefer simple interfaces",
				category: "UX",
				interview_id: interview.id,
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		expect(insight).toBeTruthy()

		// 5. Test the persona-insight relationship function
		// This should call the function that was failing with "pe.persona does not exist"
		const { data: personaInsights, error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: insight.id,
		})

		// This test should catch the schema error if it exists
		expect(error).toBeNull()
		expect(personaInsights).toBeDefined()

		// 6. Verify the persona_insights junction table was populated
		const { data: junctionRecords } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", insight.id)
			.eq("account_id", TEST_ACCOUNT_ID)

		expect(junctionRecords).toBeTruthy()
		expect(junctionRecords.length).toBeGreaterThan(0)
		expect(junctionRecords[0].persona_id).toBe(persona.id)
	})

	it("should handle people without personas gracefully", async () => {
		// Use direct testDb client with basic primitives
		const supabase = testDb

		// 1. Create a person WITHOUT a persona
		const { data: person } = await supabase
			.from("people")
			.insert({
				name: "Jane Smith",
				persona_id: null, // No persona assigned
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		expect(person).toBeTruthy()
		expect(person.persona_id).toBeNull()

		// 2. Create an interview and link the person
		const { data: interview } = await supabase
			.from("interviews")
			.insert({
				title: "Another Research Session",
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		await supabase.from("interview_people").insert({
			interview_id: interview.id,
			person_id: person.id,
			account_id: TEST_ACCOUNT_ID,
		})

		// 3. Create an insight
		const { data: insight } = await supabase
			.from("themes")
			.insert({
				name: "Users need better onboarding",
				category: "UX",
				interview_id: interview.id,
				account_id: TEST_ACCOUNT_ID,
			})
			.select()
			.single()

		// 4. Test the function with a person who has no persona
		// This should not fail and should handle null persona_id gracefully
		const { error } = await supabase.rpc("auto_link_persona_insights", {
			p_insight_id: insight.id,
		})

		expect(error).toBeNull()

		// 5. Verify no persona_insights records were created (since no persona)
		const { data: junctionRecords } = await supabase
			.from("persona_insights")
			.select("*")
			.eq("insight_id", insight.id)
			.eq("account_id", TEST_ACCOUNT_ID)

		expect(junctionRecords).toBeTruthy()
		expect(junctionRecords.length).toBe(0) // No records since no persona
	})

	it("should validate persona-people relationship schema", async () => {
		const mockRequest = new Request("http://localhost:3000", {
			headers: {
				authorization: `Bearer ${process.env.TEST_SUPABASE_ANON_KEY}`,
			},
		})

		const { client: supabase } = getServerClient(mockRequest)

		// Test that people table has persona_id column (not persona)
		const { data: tableInfo, error } = await supabase.rpc("get_table_columns", {
			table_name: "people",
		})

		if (error) {
			// If the RPC doesn't exist, test with a direct query
			const { data: person, error: queryError } = await supabase.from("people").select("persona_id").limit(1)

			expect(queryError).toBeNull()
		} else {
			// Verify persona_id column exists
			const personaIdColumn = tableInfo?.find((col: any) => col.column_name === "persona_id")
			expect(personaIdColumn).toBeTruthy()

			// Verify persona column does NOT exist (this was the bug)
			const personaColumn = tableInfo?.find((col: any) => col.column_name === "persona")
			expect(personaColumn).toBeFalsy()
		}
	})
})
