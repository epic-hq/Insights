/**
 * Tests for People database operations
 *
 * These tests verify the core CRUD operations for the people feature.
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

describe("People DB Operations", () => {
	beforeEach(async () => {
		await seedTestData()
	})

	afterAll(async () => {
		await cleanupTestData()
	})

	describe("createPerson", () => {
		it("creates a person with required fields", async () => {
			const { data: person, error } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "John",
					lastname: "Doe",
				})
				.select()
				.single()

			expect(error).toBeNull()
			expect(person).toBeDefined()
			expect(person?.firstname).toBe("John")
			expect(person?.lastname).toBe("Doe")
			expect(person?.account_id).toBe(TEST_ACCOUNT_ID)
		})

		it("creates a person with all optional fields", async () => {
			const { data: person, error } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Jane",
					lastname: "Smith",
					email: "jane@example.com",
					title: "Product Manager",
					company: "Acme Corp",
					segment: "enterprise",
					job_function: "Product",
					seniority_level: "Manager",
				})
				.select()
				.single()

			expect(error).toBeNull()
			expect(person?.email).toBe("jane@example.com")
			expect(person?.title).toBe("Product Manager")
			expect(person?.company).toBe("Acme Corp")
			expect(person?.segment).toBe("enterprise")
			expect(person?.job_function).toBe("Product")
			expect(person?.seniority_level).toBe("Manager")
		})

		it("generates a UUID for id", async () => {
			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Test",
				})
				.select()
				.single()

			expect(person?.id).toBeDefined()
			expect(person?.id).toMatch(/^[0-9a-f-]{36}$/) // UUID format
		})

		it("sets created_at timestamp automatically", async () => {
			const beforeInsert = new Date()

			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Timestamp",
				})
				.select()
				.single()

			expect(person?.created_at).toBeDefined()
			const createdAt = new Date(person!.created_at!)
			expect(createdAt.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime())
		})
	})

	describe("getPeople", () => {
		it("returns people for the correct project", async () => {
			const { data: people, error } = await testDb
				.from("people")
				.select("*")
				.eq("account_id", TEST_ACCOUNT_ID)
				.eq("project_id", TEST_PROJECT_ID)

			expect(error).toBeNull()
			expect(people).toBeInstanceOf(Array)
			expect(people!.length).toBeGreaterThanOrEqual(1) // Seeded data
		})

		it("does not return people from other accounts", async () => {
			// Insert person in different account
			const otherAccountId = crypto.randomUUID()
			const otherProjectId = crypto.randomUUID()

			await testDb.from("projects").insert({
				id: otherProjectId,
				account_id: otherAccountId,
				title: "Other Project",
			})

			await testDb.from("people").insert({
				account_id: otherAccountId,
				project_id: otherProjectId,
				firstname: "Other",
			})

			// Query with test account should not see other account's people
			const { data: people } = await testDb
				.from("people")
				.select("*")
				.eq("account_id", TEST_ACCOUNT_ID)

			const otherPerson = people?.find((p) => p.firstname === "Other")
			expect(otherPerson).toBeUndefined()

			// Cleanup
			await testDb.from("people").delete().eq("account_id", otherAccountId)
			await testDb.from("projects").delete().eq("id", otherProjectId)
		})

		it("returns people with their interview links", async () => {
			const { data: people } = await testDb
				.from("people")
				.select(
					`
					*,
					interview_people (
						interview_id,
						role
					)
				`,
				)
				.eq("account_id", TEST_ACCOUNT_ID)
				.eq("id", "person-1") // Seeded person

			expect(people).toHaveLength(1)
			expect(people![0].interview_people).toBeInstanceOf(Array)
		})
	})

	describe("getPersonById", () => {
		it("returns a specific person by ID", async () => {
			const { data: person, error } = await testDb
				.from("people")
				.select("*")
				.eq("id", "person-1")
				.eq("account_id", TEST_ACCOUNT_ID)
				.single()

			expect(error).toBeNull()
			expect(person?.id).toBe("person-1")
			expect(person?.firstname).toBe("Sarah")
		})

		it("returns null for non-existent person", async () => {
			const { data: person, error } = await testDb
				.from("people")
				.select("*")
				.eq("id", "non-existent-id")
				.eq("account_id", TEST_ACCOUNT_ID)
				.maybeSingle()

			expect(person).toBeNull()
		})

		it("returns person with related data", async () => {
			const { data: person } = await testDb
				.from("people")
				.select(
					`
					*,
					interview_people (
						interviews (
							id,
							title
						)
					)
				`,
				)
				.eq("id", "person-1")
				.single()

			expect(person?.interview_people).toBeInstanceOf(Array)
		})
	})

	describe("updatePerson", () => {
		it("updates person fields", async () => {
			const { error: updateError } = await testDb
				.from("people")
				.update({
					firstname: "Updated",
					lastname: "Name",
					title: "New Title",
				})
				.eq("id", "person-1")
				.eq("project_id", TEST_PROJECT_ID)

			expect(updateError).toBeNull()

			// Verify update
			const { data: person } = await testDb
				.from("people")
				.select("*")
				.eq("id", "person-1")
				.single()

			expect(person?.firstname).toBe("Updated")
			expect(person?.lastname).toBe("Name")
			expect(person?.title).toBe("New Title")
		})

		it("updates only specified fields", async () => {
			// Get original values
			const { data: original } = await testDb.from("people").select("*").eq("id", "person-1").single()

			// Update only firstname
			await testDb.from("people").update({ firstname: "OnlyFirst" }).eq("id", "person-1")

			const { data: updated } = await testDb.from("people").select("*").eq("id", "person-1").single()

			expect(updated?.firstname).toBe("OnlyFirst")
			expect(updated?.lastname).toBe(original?.lastname) // Unchanged
			expect(updated?.segment).toBe(original?.segment) // Unchanged
		})
	})

	describe("deletePerson", () => {
		it("deletes a person", async () => {
			// Create a person to delete
			const { data: created } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "ToDelete",
				})
				.select()
				.single()

			// Delete
			const { error: deleteError } = await testDb
				.from("people")
				.delete()
				.eq("id", created!.id)
				.eq("project_id", TEST_PROJECT_ID)

			expect(deleteError).toBeNull()

			// Verify deleted
			const { data: deleted } = await testDb
				.from("people")
				.select("*")
				.eq("id", created!.id)
				.maybeSingle()

			expect(deleted).toBeNull()
		})

		it("cascades delete to interview_people links", async () => {
			// Create person with interview link
			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Linked",
				})
				.select()
				.single()

			await testDb.from("interview_people").insert({
				interview_id: "interview-1",
				person_id: person!.id,
				role: "participant",
			})

			// Delete person
			await testDb.from("people").delete().eq("id", person!.id)

			// Verify link is also deleted
			const { data: links } = await testDb
				.from("interview_people")
				.select("*")
				.eq("person_id", person!.id)

			expect(links).toHaveLength(0)
		})
	})

	describe("interview_people linking", () => {
		it("creates link between person and interview", async () => {
			// Create a new person
			const { data: person } = await testDb
				.from("people")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Linkable",
				})
				.select()
				.single()

			// Create link
			const { error: linkError } = await testDb.from("interview_people").insert({
				interview_id: "interview-2", // Seeded interview without person
				person_id: person!.id,
				role: "participant",
			})

			expect(linkError).toBeNull()

			// Verify link exists
			const { data: links } = await testDb
				.from("interview_people")
				.select("*")
				.eq("person_id", person!.id)

			expect(links).toHaveLength(1)
			expect(links![0].interview_id).toBe("interview-2")
		})

		it("prevents duplicate links", async () => {
			// Link already exists from seeded data
			const { error: duplicateError } = await testDb.from("interview_people").insert({
				interview_id: "interview-1",
				person_id: "person-1",
				role: "participant",
			})

			// Should fail due to unique constraint
			expect(duplicateError).toBeDefined()
		})
	})
})
