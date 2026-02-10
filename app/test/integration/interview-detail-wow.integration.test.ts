/**
 * Integration tests for the interview detail "path to wow" —
 * the critical data flows a user sees when they open an interview.
 *
 * Tests against the staging Supabase database:
 * 1. Interview + evidence + lens analysis round-trip
 * 2. Conversation overview lens write → read → parse
 * 3. Evidence creation with people associations
 * 4. Evidence-to-takeaway matching with real data shapes
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type EvidenceRecord,
	type KeyTakeaway,
	matchTakeawaysToEvidence,
} from "~/features/interviews/lib/interviewDetailHelpers";
import {
	parseConversationAnalysisLegacy,
	parseConversationOverviewLens,
} from "~/features/interviews/lib/parseConversationAnalysis.server";
import { loadLensAnalyses } from "~/features/lenses/lib/loadLensAnalyses.server";
import {
	cleanupTestData,
	seedTestData,
	TEST_ACCOUNT_ID,
	TEST_INTERVIEW_1_ID,
	TEST_INTERVIEW_2_ID,
	TEST_PERSON_1_ID,
	TEST_PROJECT_ID,
	testDb,
} from "~/test/utils/testDb";

vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: () => ({ client: testDb }),
	createSupabaseAdminClient: () => testDb,
}));

// Ensure the conversation-overview template exists in staging DB
async function ensureConversationOverviewTemplate() {
	const { data: existing } = await testDb
		.from("conversation_lens_templates")
		.select("template_key")
		.eq("template_key", "conversation-overview")
		.maybeSingle();

	if (!existing) {
		const { error } = await testDb.from("conversation_lens_templates").insert({
			template_key: "conversation-overview",
			template_name: "Conversation Overview",
			summary: "AI-generated overview of the conversation",
			category: "system",
			display_order: 1,
			is_active: true,
			is_system: true,
			is_public: true,
			template_definition: { sections: [], entities: [] },
		});
		if (error) {
			console.warn("Could not seed conversation-overview template:", error.message);
		}
	}
}

describe("Interview Detail — Path to Wow", () => {
	beforeEach(async () => {
		await seedTestData();
		await ensureConversationOverviewTemplate();
	});

	afterAll(async () => {
		await cleanupTestData();
		await testDb.removeAllChannels();
	});

	// =========================================================================
	// 1. Interview loads with all required fields for the detail page
	// =========================================================================
	describe("Interview data loading", () => {
		it("should fetch interview with all detail-page fields", async () => {
			const { data: interview, error } = await testDb
				.from("interviews")
				.select(
					`
					id, title, status, media_url, media_type, source_type, file_extension,
					conversation_analysis, observations_and_notes, high_impact_themes,
					duration_sec, created_at, updated_at, transcript, transcript_formatted
				`
				)
				.eq("id", TEST_INTERVIEW_1_ID)
				.eq("project_id", TEST_PROJECT_ID)
				.single();

			expect(error).toBeNull();
			expect(interview).toBeDefined();
			expect(interview!.id).toBe(TEST_INTERVIEW_1_ID);
			expect(interview!.title).toBe("Customer Discovery Session");
			expect(interview!.status).toBe("ready");
		});

		it("should fetch participants with people join", async () => {
			const { data: participants, error } = await testDb
				.from("interview_people")
				.select(
					`
					id, role, transcript_key, display_name,
					people (
						id, name, segment
					)
				`
				)
				.eq("interview_id", TEST_INTERVIEW_1_ID);

			expect(error).toBeNull();
			expect(participants).toHaveLength(1);
			expect(participants![0].role).toBe("participant");
			const person = participants![0].people as any;
			expect(person.id).toBe(TEST_PERSON_1_ID);
		});

		it("should return empty participants for interview without people", async () => {
			const { data: participants, error } = await testDb
				.from("interview_people")
				.select("id, role, people (id, name)")
				.eq("interview_id", TEST_INTERVIEW_2_ID);

			expect(error).toBeNull();
			expect(participants).toHaveLength(0);
		});
	});

	// =========================================================================
	// 2. Evidence creation, query, and people associations
	// =========================================================================
	describe("Evidence for interview detail", () => {
		it("should create evidence and query it by interview_id", async () => {
			const { data: inserted, error: insertError } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Users struggle with onboarding flow",
					verbatim: "It took me three weeks to figure out how to set up my first project",
				})
				.select("id")
				.single();

			expect(insertError).toBeNull();
			const evidenceId = inserted!.id;

			// Query evidence the same way the detail loader does
			const { data: evidence, error: queryError } = await testDb
				.from("evidence")
				.select(
					`
					*,
					evidence_people (
						person_id, role,
						people (id, name, segment)
					)
				`
				)
				.eq("interview_id", TEST_INTERVIEW_1_ID)
				.order("created_at", { ascending: false });

			expect(queryError).toBeNull();
			expect(evidence).toBeDefined();
			expect(evidence!.length).toBeGreaterThanOrEqual(1);

			const created = evidence!.find((e) => e.id === evidenceId);
			expect(created).toBeDefined();
			expect(created!.gist).toBe("Users struggle with onboarding flow");
			expect(created!.verbatim).toContain("three weeks");
		});

		it("should link evidence to people and query the association", async () => {
			// Insert evidence
			const { data: inserted } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Quote from Sarah about pricing",
					verbatim: "The enterprise plan is too expensive for our team size",
				})
				.select("id")
				.single();

			const evidenceId = inserted!.id;

			// Link to person (account_id is required by NOT NULL constraint)
			const { error: linkError } = await testDb.from("evidence_people").insert({
				account_id: TEST_ACCOUNT_ID,
				evidence_id: evidenceId,
				person_id: TEST_PERSON_1_ID,
				role: "speaker",
			});

			expect(linkError).toBeNull();

			// Query with people join (same pattern as detail loader)
			const { data: evidence } = await testDb
				.from("evidence")
				.select(
					`
					id, gist, verbatim,
					evidence_people (
						person_id, role,
						people (id, name, segment)
					)
				`
				)
				.eq("id", evidenceId)
				.single();

			expect(evidence).toBeDefined();
			expect(evidence!.evidence_people).toHaveLength(1);
			const ep = evidence!.evidence_people[0] as any;
			expect(ep.person_id).toBe(TEST_PERSON_1_ID);
			expect(ep.people.name).toContain("Sarah");
		});
	});

	// =========================================================================
	// 3. Conversation lens write → read round-trip
	// =========================================================================
	describe("Conversation overview lens round-trip", () => {
		it("should upsert a conversation-overview lens and read it back via loadLensAnalyses", async () => {
			const analysisData = {
				overview: "Customer discovery interview about enterprise pricing concerns",
				duration_estimate: "35 minutes",
				key_takeaways: [
					{
						priority: "high",
						summary: "Enterprise pricing is a blocker for mid-market companies",
						evidence_snippets: ["too expensive for our team size"],
					},
					{
						priority: "medium",
						summary: "Users want annual billing discounts",
						evidence_snippets: ["annual plan would make it easier to budget"],
					},
				],
				recommended_next_steps: [
					{
						focus_area: "Product",
						action: "Create a mid-market pricing tier",
						rationale: "Multiple customers mentioned the gap between free and enterprise",
					},
				],
				open_questions: ["What price point would work for 10-50 seat teams?"],
				questions: [],
				participant_goals: [],
			};

			// Write lens analysis
			const { error: upsertError } = await testDb.from("conversation_lens_analyses").upsert(
				{
					interview_id: TEST_INTERVIEW_1_ID,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					template_key: "conversation-overview",
					analysis_data: analysisData,
					status: "completed",
					processed_at: new Date().toISOString(),
				},
				{ onConflict: "interview_id,template_key" }
			);

			expect(upsertError).toBeNull();

			// Read back via the production function
			const lensAnalyses = await loadLensAnalyses(testDb as any, TEST_INTERVIEW_1_ID, TEST_ACCOUNT_ID);

			const overview = lensAnalyses["conversation-overview"];
			expect(overview).toBeDefined();
			expect(overview.status).toBe("completed");
			expect(overview.analysis_data.overview).toContain("enterprise pricing");
			expect(overview.analysis_data.key_takeaways).toHaveLength(2);
			expect(overview.analysis_data.recommended_next_steps).toHaveLength(1);
		});

		it("should parse lens analysis_data into display format via parseConversationOverviewLens", async () => {
			// Write lens
			const analysisData = {
				overview: "Quick product feedback session",
				key_takeaways: [
					{
						priority: "high",
						summary: "Search is too slow",
						evidence_snippets: ["takes 5 seconds to load results"],
					},
				],
				recommended_next_steps: [
					{
						focus_area: "Product",
						action: "Optimize search index",
						rationale: "Performance is the #1 complaint",
					},
				],
				open_questions: ["Should we add full-text search?"],
			};

			await testDb.from("conversation_lens_analyses").upsert(
				{
					interview_id: TEST_INTERVIEW_1_ID,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					template_key: "conversation-overview",
					analysis_data: analysisData,
					status: "completed",
					processed_at: "2026-02-10T12:00:00Z",
				},
				{ onConflict: "interview_id,template_key" }
			);

			// Read and parse (same code path as detail loader)
			const lensAnalyses = await loadLensAnalyses(testDb as any, TEST_INTERVIEW_1_ID, TEST_ACCOUNT_ID);
			const overview = lensAnalyses["conversation-overview"];

			const parsed = parseConversationOverviewLens(
				overview.analysis_data as Record<string, unknown>,
				overview.processed_at
			);

			expect(parsed).not.toBeNull();
			expect(parsed!.summary).toBe("Quick product feedback session");
			expect(parsed!.keyTakeaways).toHaveLength(1);
			expect(parsed!.keyTakeaways[0].priority).toBe("high");
			expect(parsed!.keyTakeaways[0].summary).toBe("Search is too slow");
			expect(parsed!.recommendations).toHaveLength(1);
			expect(parsed!.recommendations[0].focusArea).toBe("Product");
			expect(parsed!.openQuestions).toEqual(["Should we add full-text search?"]);
			expect(parsed!.status).toBe("completed");
		});

		it("should fall back to legacy JSONB parsing for un-migrated interviews", async () => {
			// Write conversation_analysis JSONB directly (legacy path)
			const { error } = await testDb
				.from("interviews")
				.update({
					conversation_analysis: {
						overview: "Legacy format analysis",
						key_takeaways: [{ priority: "high", summary: "Important legacy finding", evidence_snippets: ["quote"] }],
						recommended_next_steps: [],
						open_questions: ["Legacy question?"],
						trigger_run_id: "run_old",
						current_step: "complete",
					},
				})
				.eq("id", TEST_INTERVIEW_2_ID);

			expect(error).toBeNull();

			// Read the interview
			const { data: interview } = await testDb
				.from("interviews")
				.select("conversation_analysis, updated_at")
				.eq("id", TEST_INTERVIEW_2_ID)
				.single();

			// Parse with legacy parser (same fallback as detail loader)
			const parsed = parseConversationAnalysisLegacy(
				interview!.conversation_analysis as Record<string, unknown>,
				interview!.updated_at
			);

			expect(parsed).not.toBeNull();
			expect(parsed!.summary).toBe("Legacy format analysis");
			expect(parsed!.keyTakeaways).toHaveLength(1);
			expect(parsed!.keyTakeaways[0].summary).toBe("Important legacy finding");
			expect(parsed!.openQuestions).toEqual(["Legacy question?"]);
		});
	});

	// =========================================================================
	// 4. Evidence-to-takeaway matching with real DB shapes
	// =========================================================================
	describe("Evidence-takeaway matching with real data", () => {
		it("should match AI takeaways to DB evidence records", async () => {
			// Seed realistic evidence — insert individually to get IDs back
			const { data: ev1 } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Onboarding takes too long",
					verbatim: "It took me three weeks to get my team fully onboarded onto the platform",
				})
				.select("id")
				.single();

			const { data: ev2 } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Self-serve setup preference",
					verbatim: "I just want to click a button and have everything set up without waiting for a call",
				})
				.select("id")
				.single();

			const { data: ev3 } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Dashboard is useful once configured",
					verbatim: "Once we got it working the dashboard gave us exactly what we needed",
				})
				.select("id")
				.single();

			// Read evidence back from DB (same shape as loader)
			const { data: dbEvidence } = await testDb
				.from("evidence")
				.select("id, gist, verbatim")
				.eq("interview_id", TEST_INTERVIEW_1_ID);

			// Create takeaways that should match
			const takeaways: KeyTakeaway[] = [
				{
					priority: "high",
					summary: "Onboarding is too slow",
					evidenceSnippets: ["three weeks to get my team fully onboarded"],
				},
				{
					priority: "medium",
					summary: "Users want self-serve",
					evidenceSnippets: ["click a button and have everything set up"],
				},
				{
					priority: "low",
					summary: "Dashboard value is clear post-setup",
					evidenceSnippets: ["dashboard gave us exactly what we needed"],
				},
			];

			// Run matching with real DB-shaped evidence
			matchTakeawaysToEvidence(takeaways, dbEvidence as EvidenceRecord[]);

			expect(takeaways[0].evidenceId).toBe(ev1!.id);
			expect(takeaways[1].evidenceId).toBe(ev2!.id);
			expect(takeaways[2].evidenceId).toBe(ev3!.id);
		});
	});

	// =========================================================================
	// 5. Full loader data assembly simulation
	// =========================================================================
	describe("Full detail page data assembly", () => {
		it("should assemble all data the detail page needs in one flow", async () => {
			// 1. Seed evidence (self-contained — don't rely on other test groups)
			const { data: evInserted, error: evInsertError } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: TEST_INTERVIEW_1_ID,
					gist: "Key user pain point",
					verbatim: "I can never find what I'm looking for in the search results",
				})
				.select("id")
				.single();
			expect(evInsertError).toBeNull();
			const evId = evInserted!.id;

			// 2. Seed conversation overview lens
			const { error: lensInsertError } = await testDb.from("conversation_lens_analyses").upsert(
				{
					interview_id: TEST_INTERVIEW_1_ID,
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					template_key: "conversation-overview",
					analysis_data: {
						overview: "Discovery call focused on search experience pain points",
						key_takeaways: [
							{
								priority: "high",
								summary: "Search results are not findable",
								evidence_snippets: ["never find what I'm looking for"],
							},
						],
						recommended_next_steps: [
							{
								focus_area: "Product",
								action: "Rebuild search with semantic matching",
								rationale: "Current keyword search misses intent",
							},
						],
						open_questions: ["Would AI-powered search solve this?"],
					},
					status: "completed",
					processed_at: new Date().toISOString(),
				},
				{ onConflict: "interview_id,template_key" }
			);
			expect(lensInsertError).toBeNull();

			// 3. Simulate the loader's data fetching (parallel, same as production)
			const [interviewResult, participantsResult, evidenceResult, lensAnalyses] = await Promise.all([
				testDb
					.from("interviews")
					.select("id, title, status, conversation_analysis, updated_at, created_at")
					.eq("id", TEST_INTERVIEW_1_ID)
					.single(),
				testDb
					.from("interview_people")
					.select("id, role, transcript_key, display_name, people (id, name, segment)")
					.eq("interview_id", TEST_INTERVIEW_1_ID),
				testDb
					.from("evidence")
					.select("*, evidence_people (person_id, role, people (id, name, segment))")
					.eq("interview_id", TEST_INTERVIEW_1_ID)
					.order("created_at", { ascending: false }),
				loadLensAnalyses(testDb as any, TEST_INTERVIEW_1_ID, TEST_ACCOUNT_ID),
			]);

			// 4. Assert all data loaded
			expect(interviewResult.error).toBeNull();
			expect(interviewResult.data!.title).toBe("Customer Discovery Session");

			expect(participantsResult.error).toBeNull();
			expect(participantsResult.data!.length).toBeGreaterThanOrEqual(1);

			expect(evidenceResult.error).toBeNull();
			expect(evidenceResult.data!.length).toBeGreaterThanOrEqual(1);

			const overviewLens = lensAnalyses["conversation-overview"];
			expect(overviewLens).toBeDefined();
			expect(overviewLens.status).toBe("completed");

			// 5. Parse lens → display format
			const conversationAnalysis = parseConversationOverviewLens(
				overviewLens.analysis_data as Record<string, unknown>,
				overviewLens.processed_at
			);

			expect(conversationAnalysis).not.toBeNull();
			expect(conversationAnalysis!.summary).toContain("search experience");
			expect(conversationAnalysis!.keyTakeaways).toHaveLength(1);
			expect(conversationAnalysis!.recommendations).toHaveLength(1);

			// 6. Match takeaways to evidence
			matchTakeawaysToEvidence(conversationAnalysis!.keyTakeaways, evidenceResult.data as EvidenceRecord[]);

			// The takeaway snippet "never find what I'm looking for" should match our evidence
			const matchedId = conversationAnalysis!.keyTakeaways[0].evidenceId;
			expect(matchedId).toBeDefined();
			// Verify it matched one of the evidence records for this interview
			const matchedEvidence = evidenceResult.data!.find((e) => e.id === matchedId);
			expect(matchedEvidence).toBeDefined();
		});
	});
});
