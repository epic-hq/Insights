/**
 * Test database utilities for integration tests
 * Uses real Supabase connection with seeded data
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/../supabase/types";

// Get environment variables with browser/server compatibility
const getEnvVar = (key: string): string => {
	if (typeof process !== "undefined" && process.env) {
		return process.env[key] || "";
	}
	// Browser fallback - should not be used in integration tests
	return "";
};

const TEST_SUPABASE_URL = getEnvVar("TEST_SUPABASE_URL");
const TEST_SUPABASE_ANON_KEY = getEnvVar("TEST_SUPABASE_ANON_KEY");
const TEST_SUPABASE_SERVICE_ROLE_KEY = getEnvVar("TEST_SUPABASE_SERVICE_ROLE_KEY");
const TEST_SUPABASE_PROJECT_REF = getEnvVar("TEST_SUPABASE_PROJECT_REF");
const SUPABASE_URL = getEnvVar("SUPABASE_URL");

function parseProjectRefFromSupabaseUrl(url: string): string | null {
	try {
		const hostname = new URL(url).hostname;
		if (!hostname.endsWith(".supabase.co")) return null;
		const [projectRef] = hostname.split(".");
		return projectRef || null;
	} catch {
		return null;
	}
}

// Ensure test environment variables are available (server-side only)
if (typeof process !== "undefined" && process.env) {
	if (!TEST_SUPABASE_URL) {
		throw new Error("TEST_SUPABASE_URL environment variable is required for integration tests");
	}
	if (!TEST_SUPABASE_ANON_KEY) {
		throw new Error("TEST_SUPABASE_ANON_KEY environment variable is required for integration tests");
	}

	if (SUPABASE_URL && TEST_SUPABASE_URL === SUPABASE_URL) {
		throw new Error("Refusing to run integration tests: TEST_SUPABASE_URL matches SUPABASE_URL (production/default)");
	}

	const defaultRef = SUPABASE_URL ? parseProjectRefFromSupabaseUrl(SUPABASE_URL) : null;
	const testRef = TEST_SUPABASE_PROJECT_REF || parseProjectRefFromSupabaseUrl(TEST_SUPABASE_URL);
	if (defaultRef && testRef && defaultRef === testRef) {
		throw new Error("Refusing to run integration tests: TEST and default Supabase project refs are identical");
	}
}

const TEST_DB_KEY = TEST_SUPABASE_SERVICE_ROLE_KEY || TEST_SUPABASE_ANON_KEY;

// Main integration client (service role preferred for deterministic seeding)
export const testDb = createClient<Database>(TEST_SUPABASE_URL, TEST_DB_KEY);
// Admin client used only for test-scope provisioning when service key is available
const adminDb = TEST_SUPABASE_SERVICE_ROLE_KEY
	? createClient<Database>(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY)
	: testDb;

// Test scope (initialized lazily from the connected test database)
export let TEST_ACCOUNT_ID = "";
export let TEST_PROJECT_ID = "";
let testScopeInitialized = false;
export const TEST_INTERVIEW_1_ID = "00000000-0000-0000-0000-000000000101";
export const TEST_INTERVIEW_2_ID = "00000000-0000-0000-0000-000000000102";
export const TEST_INTERVIEW_3_ID = "00000000-0000-0000-0000-000000000103";
export const TEST_PERSON_1_ID = "00000000-0000-0000-0000-000000000201";
export const TEST_TAG_1_ID = "00000000-0000-0000-0000-000000000301";
export const TEST_TAG_2_ID = "00000000-0000-0000-0000-000000000302";
export const TEST_TAG_3_ID = "00000000-0000-0000-0000-000000000303";
export const TEST_INSIGHT_1_ID = "00000000-0000-0000-0000-000000000401";
export const TEST_INSIGHT_2_ID = "00000000-0000-0000-0000-000000000402";

function assertNoError(context: string, error: { message: string } | null) {
	if (error) {
		throw new Error(`${context}: ${error.message}`);
	}
}

async function ensureTestScope() {
	if (testScopeInitialized) return;

	const { data: scopeRow, error: scopeError } = await adminDb
		.from("projects")
		.select("id, account_id")
		.limit(1)
		.single();
	assertNoError("Failed to discover test project scope", scopeError);

	if (!scopeRow?.id || !scopeRow?.account_id) {
		throw new Error("Failed to discover test project scope: missing project/account row");
	}

	TEST_ACCOUNT_ID = scopeRow.account_id;
	TEST_PROJECT_ID = scopeRow.id;
	testScopeInitialized = true;
}

/**
 * Reset database to clean state
 * Only clears test data, preserves schema
 */
async function resetTestDb() {
	await ensureTestScope();

	const { data: existingInterviews } = await testDb.from("interviews").select("id").eq("account_id", TEST_ACCOUNT_ID);
	const interviewIds = existingInterviews?.map((row) => row.id) || [];
	if (interviewIds.length > 0) {
		await testDb.from("interview_people").delete().in("interview_id", interviewIds);
		await testDb.from("people_personas").delete().in("interview_id", interviewIds);
	}

	// Clear data in dependency order (children first)
	const tables = [
		"people_personas",
		"person_facet",
		"person_scale",
		"facet_candidate",
		"project_facet",
		"facet_account",
		"evidence_people",
		"evidence",
		"interview_people",
		"research_link_responses",
		"research_links",
		"insight_tags",
		"interview_tags",
		"opportunity_insights",
		"project_people",
		"persona_insights",
		"themes",
		"insights",
		"opportunities",
		"people",
		"analysis_jobs",
		"upload_jobs",
		"interviews",
		"tags",
		"personas",
	];

	for (const table of tables) {
		await testDb
			.from(table as keyof Database["public"]["Tables"])
			.delete()
			.eq("account_id", TEST_ACCOUNT_ID);
	}
}

/**
 * Alias for resetTestDb - used by integration tests
 */
export const cleanupTestData = resetTestDb;

/**
 * Seed minimal test data for integration tests
 */
export async function seedTestData() {
	await ensureTestScope();
	await resetTestDb();

	// Seed interviews
	const { error: interviewsError } = await testDb.from("interviews").insert(
		[
			{
				id: TEST_INTERVIEW_1_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Customer Discovery Session",
				participant_pseudonym: "Sarah Chen",
				segment: "enterprise",
				interview_date: "2025-01-20",
				status: "ready",
			},
			{
				id: TEST_INTERVIEW_2_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Interview - 2025-01-21",
				participant_pseudonym: null,
				segment: "consumer",
				interview_date: "2025-01-21",
				status: "ready",
			},
			{
				id: TEST_INTERVIEW_3_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Product Feedback Call",
				participant_pseudonym: null,
				segment: null,
				interview_date: null,
				status: "processing",
			},
		],
		{ upsert: true }
	);
	assertNoError("Failed to seed interviews", interviewsError);

	// Seed one person (interview-1 has person, others don't)
	const { error: personError } = await testDb.from("people").upsert(
		{
			id: TEST_PERSON_1_ID,
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			firstname: "Sarah",
			lastname: "Chen",
			segment: "enterprise",
		},
		{ onConflict: "id" }
	);
	assertNoError("Failed to seed person", personError);

	// Link person to interview
	const { error: interviewPeopleError } = await testDb.from("interview_people").upsert(
		{
			interview_id: TEST_INTERVIEW_1_ID,
			person_id: TEST_PERSON_1_ID,
			role: "participant",
		},
		{ onConflict: "interview_id,person_id" }
	);
	assertNoError("Failed to seed interview_people", interviewPeopleError);

	// Seed tags
	const { error: tagsError } = await testDb.from("tags").upsert(
		[
			{
				id: TEST_TAG_1_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				tag: "pricing",
			},
			{
				id: TEST_TAG_2_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				tag: "usability",
			},
			{
				id: TEST_TAG_3_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				tag: "enterprise",
			},
		],
		{ onConflict: "id" }
	);
	assertNoError("Failed to seed tags", tagsError);

	// Seed insights
	const { error: themesError } = await testDb.from("themes").upsert(
		[
			{
				id: TEST_INSIGHT_1_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				interview_id: TEST_INTERVIEW_1_ID,
				name: "Pricing concerns for enterprise",
				details: "Enterprise customers are price-sensitive",
				pain: "Enterprise customers are price-sensitive",
				category: "pain_point",
				confidence: 1,
			},
			{
				id: TEST_INSIGHT_2_ID,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				interview_id: TEST_INTERVIEW_2_ID,
				name: "Usability feedback",
				details: "Interface could be more intuitive",
				pain: "Interface could be more intuitive",
				category: "feedback",
				confidence: 1,
			},
		],
		{ onConflict: "id" }
	);
	assertNoError("Failed to seed themes", themesError);

	// Seed junction table data
	const { error: insightTagsError } = await testDb.from("insight_tags").insert([
		{ account_id: TEST_ACCOUNT_ID, project_id: TEST_PROJECT_ID, insight_id: TEST_INSIGHT_1_ID, tag_id: TEST_TAG_1_ID }, // pricing
		{ account_id: TEST_ACCOUNT_ID, project_id: TEST_PROJECT_ID, insight_id: TEST_INSIGHT_1_ID, tag_id: TEST_TAG_3_ID }, // enterprise
		{ account_id: TEST_ACCOUNT_ID, project_id: TEST_PROJECT_ID, insight_id: TEST_INSIGHT_2_ID, tag_id: TEST_TAG_2_ID }, // usability
	]);
	assertNoError("Failed to seed insight_tags", insightTagsError);
}

/**
 * Verify database state for assertions
 */
export async function getTestDbState() {
	const [interviews, people, links, insights, tags, junctionTags] = await Promise.all([
		testDb.from("interviews").select("id,title").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("people").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("interview_people").select("*"),
		testDb.from("themes").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("tags").select("*").eq("account_id", TEST_ACCOUNT_ID),
		testDb.from("insight_tags").select("*"),
	]);

	return {
		interviews: interviews.data || [],
		people: people.data || [],
		interviewPeopleLinks: links.data || [],
		insights: insights.data || [],
		tags: tags.data || [],
		insightTags: junctionTags.data || [],
	};
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
	});
}

/**
 * Mock Supabase auth for test context
 */
export function mockTestAuth() {
	return {
		client: testDb,
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
	};
}
