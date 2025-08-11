/**
 * Test database utilities for integration tests
 * Uses real Supabase connection with seeded data
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "~/../supabase/types"

// Ensure test environment variables are available
if (!process.env.TEST_SUPABASE_URL) {
	throw new Error('TEST_SUPABASE_URL environment variable is required for integration tests')
}
if (!process.env.TEST_SUPABASE_ANON_KEY) {
	throw new Error('TEST_SUPABASE_ANON_KEY environment variable is required for integration tests')
}

// Test database connection using basic primitives
export const testDb = createClient<Database>(
	process.env.TEST_SUPABASE_URL,
	process.env.TEST_SUPABASE_ANON_KEY
)

// Test account for consistent seeding
export const TEST_ACCOUNT_ID = "test-account-123"
export const TEST_PROJECT_ID = "test-project-123"

/**
 * Reset database to clean state
 * Only clears test data, preserves schema
 */
export async function resetTestDb() {
	// Clear data in dependency order (children first)
	const tables = [
		"interview_people",
		"insight_tags",
		"interview_tags",
		"opportunity_insights",
		"project_people",
		"persona_insights",
		"insights",
		"opportunities",
		"people",
		"interviews",
		"projects",
		"tags",
		"personas",
	]

	for (const table of tables) {
		await testDb
			.from(table as keyof Database["public"]["Tables"])
			.delete()
			.eq("account_id", TEST_ACCOUNT_ID)
	}
}

/**
 * Alias for resetTestDb - used by integration tests
 */
export const cleanupTestData = resetTestDb

/**
 * Seed minimal test data for integration tests
 */
export async function seedTestData() {
	await resetTestDb()

	// Seed project
	await testDb.from("projects").insert({
		id: TEST_PROJECT_ID,
		account_id: TEST_ACCOUNT_ID,
		title: "Test Project",
		description: "Integration test project",
	})

	// Seed interviews
	await testDb.from("interviews").insert([
		{
			id: "interview-1",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			title: "Customer Discovery Session",
			participant_pseudonym: "Sarah Chen",
			segment: "enterprise",
			interview_date: "2025-01-20",
			status: "ready",
		},
		{
			id: "interview-2",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			title: "Interview - 2025-01-21",
			participant_pseudonym: null,
			segment: "consumer",
			interview_date: "2025-01-21",
			status: "ready",
		},
		{
			id: "interview-3",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			title: "Product Feedback Call",
			participant_pseudonym: null,
			segment: null,
			interview_date: null,
			status: "processing",
		},
	])

	// Seed one person (interview-1 has person, others don't)
	await testDb.from("people").insert({
		id: "person-1",
		account_id: TEST_ACCOUNT_ID,
		name: "Sarah Chen",
		segment: "enterprise",
	})

	// Link person to interview
	await testDb.from("interview_people").insert({
		interview_id: "interview-1",
		person_id: "person-1",
		role: "participant",
	})

	// Seed tags
	await testDb.from("tags").insert([
		{ id: "tag-1", account_id: TEST_ACCOUNT_ID, tag: "pricing", category: "topic" },
		{ id: "tag-2", account_id: TEST_ACCOUNT_ID, tag: "usability", category: "topic" },
		{ id: "tag-3", account_id: TEST_ACCOUNT_ID, tag: "enterprise", category: "segment" },
	])

	// Seed insights
	await testDb.from("insights").insert([
		{
			id: "insight-1",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			interview_id: "interview-1",
			name: "Pricing concerns for enterprise",
			content: "Enterprise customers are price-sensitive",
			category: "pain_point",
			confidence: "0.9",
		},
		{
			id: "insight-2",
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			interview_id: "interview-2",
			name: "Usability feedback",
			content: "Interface could be more intuitive",
			category: "feedback",
			confidence: "0.8",
		},
	])

	// Seed junction table data
	await testDb.from("insight_tags").insert([
		{ account_id: TEST_ACCOUNT_ID, insight_id: "insight-1", tag: "tag-1" }, // pricing
		{ account_id: TEST_ACCOUNT_ID, insight_id: "insight-1", tag: "tag-3" }, // enterprise
		{ account_id: TEST_ACCOUNT_ID, insight_id: "insight-2", tag: "tag-2" }, // usability
	])
}

/**
 * Verify database state for assertions
 */
export async function getTestDbState() {
	const [interviews, people, links, insights, tags, junctionTags] = await Promise.all([
		testDb.from("interviews").select("id,title").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("people").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("interview_people").select("*"),
		testDb.from("insights").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("tags").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("insight_tags").select("*"),
	])

	return {
		interviews: interviews.data || [],
		people: people.data || [],
		interviewPeopleLinks: links.data || [],
		insights: insights.data || [],
		tags: tags.data || [],
		insightTags: junctionTags.data || [],
	}
}

/**
 * Create mock request with test account context
 */
export function createTestRequest(path = "/", options: RequestInit = {}): Request {
	return new Request(`http://localhost:3000${path}`, {
		headers: {
			Authorization: "Bearer test-jwt-token",
			"Content-Type": "application/json",
			...options.headers,
		},
		...options,
	})
}

/**
 * Mock Supabase auth for test context
 */
export function mockTestAuth() {
	return {
		auth: {
			getUser: () =>
				Promise.resolve({
					data: { user: { id: "test-user-123" } },
					error: null,
				}),
			getSession: () =>
				Promise.resolve({
					data: {
						session: {
							user: {
								app_metadata: {
									claims: { sub: TEST_ACCOUNT_ID },
								},
							},
						},
					},
					error: null,
				}),
		},
	}
}
