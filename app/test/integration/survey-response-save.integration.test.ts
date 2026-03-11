/**
 * Integration tests for survey response save endpoint.
 * Tests the full flow against the real Supabase instance.
 *
 * Run: dotenvx run -- vitest run app/test/integration/survey-response-save.integration.test.ts
 *
 * Covers:
 * - Anonymous survey completion (the null email bug fix)
 * - Identified survey completion with person creation
 * - Evidence extraction for text questions
 * - Structural question type filtering (likert, single_select skipped)
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Create admin client directly from test DB env vars
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL!;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error(
		"TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY must be set. Run with: dotenvx run -- vitest run ..."
	);
}
if (process.env.SUPABASE_URL && process.env.TEST_SUPABASE_URL === process.env.SUPABASE_URL) {
	throw new Error("Refusing to run integration test against default SUPABASE_URL");
}

const adminDb = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY);

// Mock supabase client factory to return our admin client
vi.mock("~/lib/supabase/client.server", () => ({
	createSupabaseAdminClient: () => adminDb,
}));

vi.mock("consola", () => ({
	default: {
		error: vi.fn((...args: unknown[]) => console.error(...args)),
		info: vi.fn((...args: unknown[]) => console.info(...args)),
		warn: vi.fn((...args: unknown[]) => console.warn(...args)),
	},
}));

// Test data IDs — unique per run to avoid collisions
const RESEARCH_LINK_ID = crypto.randomUUID();
const RESEARCH_LINK_SLUG = `test-survey-${Date.now()}`;
const ANON_RESPONSE_ID = crypto.randomUUID();
const IDENTIFIED_RESPONSE_ID = crypto.randomUUID();
const TEST_EMAIL = `survey-test-${Date.now()}@example.com`;

// We need a real account_id and project_id. Look one up from the DB.
let TEST_ACCOUNT_ID: string;
let TEST_PROJECT_ID: string;

async function findTestProject() {
	const { data } = await adminDb.from("projects").select("id, account_id").limit(1).single();
	if (!data) throw new Error("No projects found in DB — cannot run integration tests");
	TEST_ACCOUNT_ID = data.account_id;
	TEST_PROJECT_ID = data.id;
}

async function seedSurveyData() {
	const { error: linkError } = await adminDb.from("research_links").insert({
		id: RESEARCH_LINK_ID,
		account_id: TEST_ACCOUNT_ID,
		project_id: TEST_PROJECT_ID,
		name: "Pizza Preferences Survey (test)",
		slug: RESEARCH_LINK_SLUG,
		is_live: true,
		identity_mode: "anonymous",
		questions: [
			{
				id: "q-text",
				prompt: "What is your favorite pizza topping and why?",
				type: "auto",
			},
			{
				id: "q-select",
				prompt: "How often do you eat pizza?",
				type: "single_select",
				options: ["Daily", "Weekly", "Monthly"],
			},
			{
				id: "q-likert",
				prompt: "Rate your pizza satisfaction",
				type: "likert",
				likertScale: 5,
			},
			{
				id: "q-longtext",
				prompt: "Describe your ideal pizza experience",
				type: "long_text",
			},
		],
	});
	if (linkError) throw new Error(`Failed to seed research link: ${linkError.message}`);

	const { error: anonError } = await adminDb.from("research_link_responses").insert({
		id: ANON_RESPONSE_ID,
		research_link_id: RESEARCH_LINK_ID,
		email: null,
		phone: null,
		responses: {},
		completed: false,
	});
	if (anonError) throw new Error(`Failed to seed anonymous response: ${anonError.message}`);

	const { error: identError } = await adminDb.from("research_link_responses").insert({
		id: IDENTIFIED_RESPONSE_ID,
		research_link_id: RESEARCH_LINK_ID,
		email: TEST_EMAIL,
		responses: {},
		completed: false,
	});
	if (identError) throw new Error(`Failed to seed identified response: ${identError.message}`);
}

async function cleanupSurveyData() {
	// Clean up in dependency order
	await adminDb
		.from("evidence_people")
		.delete()
		.eq("account_id", TEST_ACCOUNT_ID)
		.in(
			"evidence_id",
			(await adminDb.from("evidence").select("id").eq("research_link_response_id", ANON_RESPONSE_ID)).data?.map(
				(e) => e.id
			) ?? []
		);
	await adminDb
		.from("evidence_people")
		.delete()
		.eq("account_id", TEST_ACCOUNT_ID)
		.in(
			"evidence_id",
			(await adminDb.from("evidence").select("id").eq("research_link_response_id", IDENTIFIED_RESPONSE_ID)).data?.map(
				(e) => e.id
			) ?? []
		);
	await adminDb.from("evidence").delete().eq("research_link_response_id", ANON_RESPONSE_ID);
	await adminDb.from("evidence").delete().eq("research_link_response_id", IDENTIFIED_RESPONSE_ID);
	await adminDb.from("research_link_responses").delete().eq("research_link_id", RESEARCH_LINK_ID);
	await adminDb.from("research_links").delete().eq("id", RESEARCH_LINK_ID);
	await adminDb.from("people").delete().eq("primary_email", TEST_EMAIL);
}

describe("Survey Response Save Integration", () => {
	beforeAll(async () => {
		await findTestProject();
		await seedSurveyData();
	}, 15000);

	afterAll(async () => {
		await cleanupSurveyData();
	}, 15000);

	describe("anonymous survey completion (regression: null email bug)", () => {
		it("should complete without crashing when email is null", async () => {
			const { action } = await import("~/routes/api.research-links.$slug.save");

			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: ANON_RESPONSE_ID,
					responses: {
						"q-text": "Pepperoni because it has the perfect balance of spice and flavor",
						"q-select": "Weekly",
						"q-likert": "4",
						"q-longtext": "A wood-fired oven, fresh mozzarella, and a cold drink on a summer evening",
					},
					completed: true,
				}),
			});

			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect(response).toBeDefined();
			expect((response as { ok: boolean }).ok).toBe(true);
		});

		it("should mark the response as completed in DB", async () => {
			const { data } = await adminDb
				.from("research_link_responses")
				.select("completed, responses")
				.eq("id", ANON_RESPONSE_ID)
				.single();

			expect(data?.completed).toBe(true);
			expect(data?.responses).toBeTruthy();
		});

		it("should NOT create a person record for anonymous response", async () => {
			// Anonymous completion should not create an identified person record.
			const { data: people, error } = await adminDb.from("people").select("id").eq("primary_email", TEST_EMAIL);
			expect(error).toBeNull();
			expect(people ?? []).toHaveLength(0);
		});

		it("should create evidence for each answered survey question", async () => {
			const { data: evidence } = await adminDb
				.from("evidence")
				.select("id, verbatim, method")
				.eq("research_link_response_id", ANON_RESPONSE_ID);

			expect(evidence).toBeTruthy();
			expect(evidence!.length).toBe(4);

			const verbatims = evidence!.map((e) => e.verbatim);
			expect(verbatims.some((v) => v?.includes("favorite pizza topping"))).toBe(true);
			expect(verbatims.some((v) => v?.includes("ideal pizza experience"))).toBe(true);
			expect(verbatims.some((v) => v?.includes("How often do you eat pizza?"))).toBe(true);
			expect(verbatims.some((v) => v?.includes("Rate your pizza satisfaction"))).toBe(true);
			expect(evidence!.every((e) => e.method === "survey")).toBe(true);
		});

		it("should create survey_response evidence_facet rows for each answered question", async () => {
			const { data: facets, error } = await adminDb
				.from("evidence_facet")
				.select("id, kind_slug, label, quote, person_id")
				.eq("project_id", TEST_PROJECT_ID)
				.eq("kind_slug", "survey_response")
				.in(
					"evidence_id",
					(await adminDb.from("evidence").select("id").eq("research_link_response_id", ANON_RESPONSE_ID)).data?.map(
						(row) => row.id
					) ?? []
				);

			expect(error).toBeNull();
			expect((facets ?? []).length).toBe(4);
			expect((facets ?? []).every((row) => row.kind_slug === "survey_response")).toBe(true);
			expect((facets ?? []).some((row) => row.label.includes("How often do you eat pizza"))).toBe(true);
			expect((facets ?? []).some((row) => row.quote?.includes("Weekly"))).toBe(true);
		});
	});

	describe("identified survey completion", () => {
		it("should complete and create/find person for identified response", async () => {
			const { action } = await import("~/routes/api.research-links.$slug.save");

			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: IDENTIFIED_RESPONSE_ID,
					responses: {
						"q-text": "Margherita is the classic that never disappoints",
						"q-select": "Monthly",
						"q-likert": "5",
						"q-longtext": "Simple ingredients, perfectly cooked",
					},
					completed: true,
				}),
			});

			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect(response).toBeDefined();
			expect((response as { ok: boolean }).ok).toBe(true);
		});

		it("should create a person record from email", async () => {
			const { data: person } = await adminDb
				.from("people")
				.select("id, primary_email, person_type")
				.eq("primary_email", TEST_EMAIL)
				.maybeSingle();

			expect(person?.id).toBeTruthy();
			expect(person?.primary_email).toBe(TEST_EMAIL);
			expect(person?.person_type).toBe("respondent");
		});

		it("should create evidence linked to person", async () => {
			const { data: evidence } = await adminDb
				.from("evidence")
				.select("id, research_link_response_id")
				.eq("research_link_response_id", IDENTIFIED_RESPONSE_ID);

			expect(evidence).toBeTruthy();
			expect(evidence!.length).toBe(4);

			for (const ev of evidence!) {
				const { data: links } = await adminDb
					.from("evidence_people")
					.select("person_id, role")
					.eq("evidence_id", ev.id);

				expect(links).toBeTruthy();
				expect(links!.length).toBe(1);
				expect(links![0].role).toBe("respondent");
			}
		});

		it("should set person_id on survey_response evidence_facet rows for identified respondents", async () => {
			const { data: person } = await adminDb.from("people").select("id").eq("primary_email", TEST_EMAIL).maybeSingle();
			expect(person?.id).toBeTruthy();

			const evidenceIds =
				(await adminDb.from("evidence").select("id").eq("research_link_response_id", IDENTIFIED_RESPONSE_ID)).data?.map(
					(row) => row.id
				) ?? [];

			const { data: facets, error } = await adminDb
				.from("evidence_facet")
				.select("person_id, kind_slug")
				.eq("kind_slug", "survey_response")
				.in("evidence_id", evidenceIds);

			expect(error).toBeNull();
			expect((facets ?? []).length).toBe(4);
			expect((facets ?? []).every((row) => row.person_id === person?.id)).toBe(true);
		});
	});

	describe("validation", () => {
		it("should return 400 for missing responseId", async () => {
			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ responses: {} }),
			});
			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect((response as Response).status).toBe(400);
		});

		it("should return 404 for nonexistent slug", async () => {
			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request("http://localhost/api/research-links/nonexistent-slug/save", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: crypto.randomUUID(),
					responses: {},
				}),
			});
			const response = await action({
				request,
				params: { slug: "nonexistent-slug" },
				context: {},
			} as never);
			expect((response as Response).status).toBe(404);
		});

		it("should return 404 for nonexistent responseId", async () => {
			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: crypto.randomUUID(),
					responses: {},
				}),
			});
			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect((response as Response).status).toBe(404);
		});
	});

	describe("embedding queue enqueue regressions", () => {
		it("should enqueue facet embedding messages in pgmq after evidence_facet insert", async () => {
			// Guards against the SECURITY DEFINER regression on enqueue_facet_embedding().
			// If prosecdef=false, service_role gets "permission denied for table q_facet_embedding_queue"
			// and embeddings silently never generate. Queue depth > 0 proves the trigger fired.
			// Uses a narrow RPC (security definer) because pgmq schema is not exposed via PostgREST.
			const { data: depth, error } = await adminDb.rpc("get_facet_embedding_queue_depth");

			expect(error).toBeNull();
			// At minimum the 4 facets from anonymous completion must have been enqueued
			expect(Number(depth)).toBeGreaterThanOrEqual(4);
		});

		it("should enqueue evidence embedding messages in pgmq after evidence insert", async () => {
			// Guards against enqueue_evidence_embedding() SECURITY DEFINER regression.
			// Evidence rows use insights_embedding_queue with table='evidence'.
			const { data: depth, error } = await adminDb.rpc("get_insights_embedding_queue_depth", {
				filter_table: "evidence",
			});

			expect(error).toBeNull();
			// At minimum the 4 evidence rows from anonymous completion must have been enqueued
			expect(Number(depth)).toBeGreaterThanOrEqual(4);
		});
	});

	describe("durability regressions", () => {
		it("should merge partial saves by default without erasing existing answers", async () => {
			const partialResponseId = crypto.randomUUID();
			const { error: seedError } = await adminDb.from("research_link_responses").insert({
				id: partialResponseId,
				research_link_id: RESEARCH_LINK_ID,
				email: null,
				phone: null,
				responses: {
					"q-text": "Original long answer",
					"q-select": "Weekly",
				},
				completed: false,
			});
			expect(seedError).toBeNull();

			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: partialResponseId,
					responses: {
						"q-longtext": "New partial answer",
					},
				}),
			});

			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect((response as { ok: boolean }).ok).toBe(true);

			const { data } = await adminDb.from("research_link_responses").select("responses").eq("id", partialResponseId).single();
			expect(data?.responses).toMatchObject({
				"q-text": "Original long answer",
				"q-select": "Weekly",
				"q-longtext": "New partial answer",
			});

			await adminDb.from("research_link_responses").delete().eq("id", partialResponseId);
		});

		it("should not unset completed on autosave when completed is omitted", async () => {
			const completedResponseId = crypto.randomUUID();
			const { error: seedError } = await adminDb.from("research_link_responses").insert({
				id: completedResponseId,
				research_link_id: RESEARCH_LINK_ID,
				email: null,
				phone: null,
				responses: {
					"q-text": "Completed answer",
				},
				completed: true,
			});
			expect(seedError).toBeNull();

			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: completedResponseId,
					responses: {
						"q-longtext": "Autosaved later answer",
					},
				}),
			});

			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect((response as { ok: boolean }).ok).toBe(true);

			const { data } = await adminDb
				.from("research_link_responses")
				.select("completed, responses")
				.eq("id", completedResponseId)
				.single();
			expect(data?.completed).toBe(true);
			expect(data?.responses).toMatchObject({
				"q-text": "Completed answer",
				"q-longtext": "Autosaved later answer",
			});

			await adminDb.from("research_link_responses").delete().eq("id", completedResponseId);
		});

		it("should allow explicit fullSnapshot saves to intentionally remove answers", async () => {
			const snapshotResponseId = crypto.randomUUID();
			const { error: seedError } = await adminDb.from("research_link_responses").insert({
				id: snapshotResponseId,
				research_link_id: RESEARCH_LINK_ID,
				email: null,
				phone: null,
				responses: {
					"q-text": "Answer to remove",
					"q-select": "Weekly",
				},
				completed: false,
			});
			expect(seedError).toBeNull();

			const { action } = await import("~/routes/api.research-links.$slug.save");
			const request = new Request(`http://localhost/api/research-links/${RESEARCH_LINK_SLUG}/save`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					responseId: snapshotResponseId,
					responses: {
						"q-select": "Weekly",
					},
					fullSnapshot: true,
					completed: false,
				}),
			});

			const response = await action({
				request,
				params: { slug: RESEARCH_LINK_SLUG },
				context: {},
			} as never);
			expect((response as { ok: boolean }).ok).toBe(true);

			const { data } = await adminDb.from("research_link_responses").select("responses").eq("id", snapshotResponseId).single();
			expect(data?.responses).toEqual({
				"q-select": "Weekly",
			});

			await adminDb.from("research_link_responses").delete().eq("id", snapshotResponseId);
		});
	});
});
