import { createClient } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Database } from "~/../supabase/types"

// Integration test using real Supabase instance (requires environment variables)
const supabaseUrl = typeof process !== "undefined" ? process.env.SUPABASE_URL : undefined
const supabaseKey = typeof process !== "undefined" ? process.env.SUPABASE_ANON_KEY : undefined

// Skip integration tests if environment variables not available or in browser
const skipIntegration = !supabaseUrl || !supabaseKey || typeof process === "undefined"

const testDb = skipIntegration ? null : createClient<Database>(supabaseUrl, supabaseKey)
const TEST_ACCOUNT_ID = "test-persona-assignment"
const TEST_PROJECT_ID = "test-project-assignment"

describe.skipIf(skipIntegration)("Persona Assignment Integration", () => {
	beforeEach(async () => {
		if (!testDb) return

		// Clean up test data
		await testDb.from("people_personas").delete().eq("project_id", TEST_PROJECT_ID)
		await testDb.from("interview_people").delete().eq("project_id", TEST_PROJECT_ID)
		await testDb.from("personas").delete().eq("account_id", TEST_ACCOUNT_ID)
		await testDb.from("people").delete().eq("account_id", TEST_ACCOUNT_ID)
		await testDb.from("interviews").delete().eq("account_id", TEST_ACCOUNT_ID)
	})

	afterEach(async () => {
		if (!testDb) return

		// Clean up test data
		await testDb.from("people_personas").delete().eq("project_id", TEST_PROJECT_ID)
		await testDb.from("interview_people").delete().eq("project_id", TEST_PROJECT_ID)
		await testDb.from("personas").delete().eq("account_id", TEST_ACCOUNT_ID)
		await testDb.from("people").delete().eq("account_id", TEST_ACCOUNT_ID)
		await testDb.from("interviews").delete().eq("account_id", TEST_ACCOUNT_ID)
	})

	it("should create persona and link to person correctly", async () => {
		if (!testDb) return

		// Create a persona
		const { data: persona, error: personaError } = await testDb
			.from("personas")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				name: "Test Persona",
				description: "A test persona for validation",
			})
			.select()
			.single()

		expect(personaError).toBeNull()
		expect(persona).toBeDefined()

		// Create a person
		const { data: person, error: personError } = await testDb
			.from("people")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				firstname: "Test",
				lastname: "Person",
			})
			.select()
			.single()

		expect(personError).toBeNull()
		expect(person).toBeDefined()

		// Create an interview
		const { data: interview, error: interviewError } = await testDb
			.from("interviews")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Test Interview",
				transcript: "Test transcript content",
				status: "ready",
			})
			.select()
			.single()

		expect(interviewError).toBeNull()
		expect(interview).toBeDefined()

		// Link person to persona (simulating AI assignment)
		if (!person?.id || !persona?.id || !interview?.id) {
			throw new Error("Failed to create required test data")
		}

		const { error: linkError } = await testDb.from("people_personas").insert({
			person_id: person.id,
			persona_id: persona.id,
			interview_id: interview.id,
			project_id: TEST_PROJECT_ID,
			confidence_score: 0.85,
			source: "ai_assignment",
		})

		expect(linkError).toBeNull()

		// Verify the link was created
		const { data: link } = await testDb
			.from("people_personas")
			.select("*")
			.eq("person_id", person.id)
			.eq("persona_id", persona.id)
			.single()

		expect(link).toBeDefined()
		if (link) {
			expect(link.confidence_score).toBe(0.85)
			expect(link.source).toBe("ai_assignment")
		}
	})

	it("should handle multiple personas per account", async () => {
		if (!testDb) return

		// Create multiple personas
		const { data: personas, error: personasError } = await testDb
			.from("personas")
			.insert([
				{
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Persona A",
					description: "First test persona",
				},
				{
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					name: "Persona B",
					description: "Second test persona",
				},
			])
			.select()

		expect(personasError).toBeNull()
		expect(personas).toHaveLength(2)

		// Verify personas are distinct
		if (personas) {
			const personaNames = personas.map((p) => p.name)
			expect(personaNames).toContain("Persona A")
			expect(personaNames).toContain("Persona B")
			expect(new Set(personaNames).size).toBe(2) // Ensure uniqueness
		}
	})

	it("should maintain data integrity with proper account scoping", async () => {
		if (!testDb) return

		const DIFFERENT_ACCOUNT = "different-account-123"

		// Create persona in test account
		const { data: testPersona } = await testDb
			.from("personas")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				name: "Test Account Persona",
				description: "Persona in test account",
			})
			.select()
			.single()

		// Create persona in different account
		const { data: otherPersona } = await testDb
			.from("personas")
			.insert({
				account_id: DIFFERENT_ACCOUNT,
				project_id: TEST_PROJECT_ID,
				name: "Other Account Persona",
				description: "Persona in different account",
			})
			.select()
			.single()

		expect(testPersona).toBeDefined()
		expect(otherPersona).toBeDefined()

		// Query personas for test account only
		const { data: testAccountPersonas } = await testDb.from("personas").select("*").eq("account_id", TEST_ACCOUNT_ID)

		// Should only return personas from test account
		expect(testAccountPersonas).toHaveLength(1)
		if (testAccountPersonas && testAccountPersonas.length > 0) {
			expect(testAccountPersonas[0].name).toBe("Test Account Persona")
			expect(testAccountPersonas[0].account_id).toBe(TEST_ACCOUNT_ID)
		}

		// Clean up the different account persona
		await testDb.from("personas").delete().eq("account_id", DIFFERENT_ACCOUNT)
	})
})
