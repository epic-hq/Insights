/**
 * Integration tests for person attribution across all 4 ingestion paths.
 *
 * TrustCore: Validates that evidence_facet.person_id and evidence_people
 * stay consistent across:
 * 1. Trigger v2 (extractEvidenceCore)
 * 2. Desktop realtime (api.desktop.realtime-evidence)
 * 3. Desktop finalize (api.desktop.interviews.finalize)
 * 4. Legacy processInterview
 *
 * Tests verify:
 * - person_id is set at INSERT time (correct pattern)
 * - evidence_people and evidence_facet.person_id remain in sync
 * - Parity validation catches drift
 *
 * SETUP: Requires TEST_SUPABASE_URL and TEST_SUPABASE_ANON_KEY configured in .env.test
 * This ensures tests run against a dedicated test database, not production.
 * See .env.example for required environment variables.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FacetResolver } from "~/lib/database/facets.server";
import { validateAttributionParity } from "~/lib/evidence/personAttribution.server";
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

// Mock BAML client
vi.mock("~/../baml_client", () => ({
	b: {
		withOptions: vi.fn(function withOptions() {
			return this;
		}),
		ExtractEvidenceFromTranscriptV2: vi.fn(),
		DerivePersonaFacetsFromEvidence: vi.fn(),
		GenerateKeyTakeawaysFromEvidence: vi.fn(),
	},
}));

vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: () => ({ client: testDb }),
	createSupabaseAdminClient: () => testDb,
}));

import { b } from "~/../baml_client";
import type { Interview } from "~/types";
import { extractEvidenceAndPeopleCore } from "../../../src/trigger/interview/v2/extractEvidenceCore";

const mockExtractEvidence = b.ExtractEvidenceFromTranscriptV2 as ReturnType<typeof vi.fn>;
const mockDerivePersonaFacets = b.DerivePersonaFacetsFromEvidence as ReturnType<typeof vi.fn>;

describe("Person Attribution Integration Tests", () => {
	vi.setConfig({ hookTimeout: 30000 }); // Increase hook timeout for database operations

	let testInterviewId: string;
	let testPersonId1: string;
	let testPersonId2: string;

	beforeEach(async () => {
		// Reset mocks
		mockExtractEvidence.mockReset();
		mockDerivePersonaFacets.mockReset();

		// Clean and seed test data
		await cleanupTestData();
		await seedTestData();

		// Seed facet kinds (required for FacetResolver)
		// Using proper seeds from _NORUN_seed.sql
		await testDb.from("facet_kind_global").upsert(
			[
				{
					slug: "goal",
					label: "Goal",
					description: "Desired outcomes and success definitions",
				},
				{
					slug: "pain",
					label: "Pain",
					description: "Frustrations, blockers, and negative moments",
				},
				{
					slug: "behavior",
					label: "Behavior",
					description: "Observable actions and habits",
				},
				{
					slug: "workflow",
					label: "Workflow",
					description: "Steps or rituals followed to accomplish tasks",
				},
			],
			{ onConflict: "slug" }
		);

		// Create test interview
		const { data: interview, error: interviewError } = await testDb
			.from("interviews")
			.insert({
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				title: "Person Attribution Test Interview",
				status: "processing",
				source_type: "upload",
			})
			.select("id")
			.single();

		if (interviewError || !interview) throw new Error("Failed to seed test interview");
		testInterviewId = interview.id;

		// Create test people
		const { data: people, error: peopleError } = await testDb
			.from("people")
			.insert([
				{
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Alice",
					lastname: "Speaker",
					role: "participant",
				},
				{
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					firstname: "Bob",
					lastname: "Interviewer",
					role: "interviewer",
				},
			])
			.select("id");

		if (peopleError || !people || people.length !== 2) throw new Error("Failed to seed test people");
		testPersonId1 = people[0].id;
		testPersonId2 = people[1].id;

		// Create interview_people links
		await testDb.from("interview_people").insert([
			{
				interview_id: testInterviewId,
				person_id: testPersonId1,
				project_id: TEST_PROJECT_ID,
				transcript_key: "SPEAKER A",
				display_name: "Alice Speaker",
				role: "participant",
			},
			{
				interview_id: testInterviewId,
				person_id: testPersonId2,
				project_id: TEST_PROJECT_ID,
				transcript_key: "SPEAKER B",
				display_name: "Bob Interviewer",
				role: "interviewer",
			},
		]);
	});

	describe("Trigger v2 Path (extractEvidenceCore)", () => {
		it("should set person_id at INSERT time for evidence_facet", async () => {
			// Mock BAML response
			mockExtractEvidence.mockResolvedValue({
				facet_catalog_version: "test",
				interaction_context: "Research",
				context_confidence: 0.9,
				context_reasoning: "Test",
				evidence: [
					{
						verbatim: "I need to move faster",
						chunk: "I need to move faster",
						gist: "Speed is important",
						person_key: "person-0",
						facet_mentions: [
							{
								kind_slug: "goal",
								value: "Move Faster",
								quote: "I need to move faster",
							},
						],
					},
					{
						verbatim: "Everything is too slow",
						chunk: "Everything is too slow",
						gist: "Performance issues",
						person_key: "person-0",
						facet_mentions: [
							{
								kind_slug: "pain",
								value: "Too Slow",
								quote: "Everything is too slow",
							},
						],
					},
				],
				people: [
					{
						person_key: "person-0",
						speaker_label: "SPEAKER A",
						display_name: "Alice",
						role: "participant",
					},
				],
			});

			mockDerivePersonaFacets.mockResolvedValue({
				persona_facets: [],
			});

			// Get interview record
			const { data: interview } = await testDb.from("interviews").select("*").eq("id", testInterviewId).single();

			if (!interview) throw new Error("Interview not found");

			// Call extractEvidenceCore
			const result = await extractEvidenceAndPeopleCore({
				db: testDb,
				metadata: {
					accountId: TEST_ACCOUNT_ID,
					projectId: TEST_PROJECT_ID,
				},
				interviewRecord: interview as Interview,
				transcriptData: {
					speaker_transcripts: [
						{
							speaker: "SPEAKER A",
							text: "I need to move faster. Everything is too slow.",
							start: 0,
							end: 5000,
						},
					],
				},
				language: "en",
			});

			// Verify evidence was created
			expect(result.insertedEvidenceIds.length).toBe(2);

			// Verify evidence_facet has person_id set
			const { data: facets } = await testDb
				.from("evidence_facet")
				.select("evidence_id, person_id, kind_slug")
				.in("evidence_id", result.insertedEvidenceIds);

			expect(facets).toBeDefined();
			expect(facets?.length).toBeGreaterThan(0);

			// CRITICAL: All facets should have person_id set at INSERT time
			for (const facet of facets ?? []) {
				expect(facet.person_id).toBeTruthy();
				expect(facet.person_id).toBe(testPersonId1); // Should match SPEAKER A
			}

			// Verify evidence_people has matching person_id
			const { data: evidencePeople } = await testDb
				.from("evidence_people")
				.select("evidence_id, person_id")
				.in("evidence_id", result.insertedEvidenceIds);

			expect(evidencePeople).toBeDefined();
			expect(evidencePeople?.length).toBeGreaterThan(0);

			for (const link of evidencePeople ?? []) {
				expect(link.person_id).toBe(testPersonId1);
			}

			// Validate parity
			const parityResult = await validateAttributionParity(testDb, testInterviewId, "trigger-v2");

			expect(parityResult.passed).toBe(true);
			expect(parityResult.mismatches).toBe(0);
		});

		it("should handle multiple speakers correctly", async () => {
			mockExtractEvidence.mockResolvedValue({
				facet_catalog_version: "test",
				interaction_context: "Research",
				context_confidence: 0.9,
				context_reasoning: "Test",
				evidence: [
					{
						verbatim: "I need speed",
						chunk: "I need speed",
						gist: "Speed goal",
						person_key: "person-0",
						facet_mentions: [
							{
								kind_slug: "goal",
								value: "Move Faster",
								quote: "I need speed",
							},
						],
					},
					{
						verbatim: "What are your pain points?",
						chunk: "What are your pain points?",
						gist: "Asking about pains",
						person_key: "person-1",
						facet_mentions: [],
					},
				],
				people: [
					{
						person_key: "person-0",
						speaker_label: "SPEAKER A",
						display_name: "Alice",
						role: "participant",
					},
					{
						person_key: "person-1",
						speaker_label: "SPEAKER B",
						display_name: "Bob",
						role: "interviewer",
					},
				],
			});

			mockDerivePersonaFacets.mockResolvedValue({
				persona_facets: [],
			});

			const { data: interview } = await testDb.from("interviews").select("*").eq("id", testInterviewId).single();

			if (!interview) throw new Error("Interview not found");

			const result = await extractEvidenceAndPeopleCore({
				db: testDb,
				metadata: {
					accountId: TEST_ACCOUNT_ID,
					projectId: TEST_PROJECT_ID,
				},
				interviewRecord: interview as Interview,
				transcriptData: {
					speaker_transcripts: [
						{ speaker: "SPEAKER A", text: "I need speed", start: 0, end: 2000 },
						{
							speaker: "SPEAKER B",
							text: "What are your pain points?",
							start: 2000,
							end: 4000,
						},
					],
				},
				language: "en",
			});

			// Verify facets for SPEAKER A have correct person_id
			const { data: facetsA } = await testDb
				.from("evidence_facet")
				.select("person_id, kind_slug")
				.eq("evidence_id", result.insertedEvidenceIds[0]);

			expect(facetsA?.every((f) => f.person_id === testPersonId1)).toBe(true);

			// Validate overall parity
			const parityResult = await validateAttributionParity(testDb, testInterviewId, "trigger-v2");

			expect(parityResult.passed).toBe(true);
		});
	});

	describe("Parity Validation", () => {
		it("should detect mismatches when evidence_facet.person_id is null", async () => {
			// Create evidence
			const { data: evidence } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: testInterviewId,
					verbatim: "Test evidence",
					gist: "Test",
					chunk: "Test",
					source_type: "primary",
					method: "interview",
					modality: "qual",
				})
				.select("id")
				.single();

			if (!evidence) throw new Error("Failed to create test evidence");

			// Create evidence_people link
			await testDb.from("evidence_people").insert({
				evidence_id: evidence.id,
				person_id: testPersonId1,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				role: "speaker",
			});

			// Use FacetResolver to create facet_account (matches production pattern)
			const facetResolver = new FacetResolver(testDb, TEST_ACCOUNT_ID);
			const facetAccountId = await facetResolver.ensureFacet({
				kindSlug: "goal",
				label: "Move Faster",
				isActive: true,
			});

			if (!facetAccountId) throw new Error("Failed to create facet_account via FacetResolver");

			// Create evidence_facet WITHOUT person_id (simulating drift)
			await testDb.from("evidence_facet").insert({
				evidence_id: evidence.id,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				person_id: null, // NULL - this is the drift!
				kind_slug: "goal",
				facet_account_id: facetAccountId,
				label: "Move Faster",
				source: "interview",
				confidence: 0.8,
			});

			// Validate parity - should FAIL
			const parityResult = await validateAttributionParity(testDb, testInterviewId, "trigger-v2");

			expect(parityResult.passed).toBe(false);
			expect(parityResult.mismatches).toBeGreaterThan(0);
		});

		it("should detect mismatches when person_ids differ", async () => {
			// Create evidence
			const { data: evidence } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: testInterviewId,
					verbatim: "Test evidence",
					gist: "Test",
					chunk: "Test",
					source_type: "primary",
					method: "interview",
					modality: "qual",
				})
				.select("id")
				.single();

			if (!evidence) throw new Error("Failed to create test evidence");

			// evidence_people says person 1
			await testDb.from("evidence_people").insert({
				evidence_id: evidence.id,
				person_id: testPersonId1,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				role: "speaker",
			});

			// Use FacetResolver to create facet_account
			const facetResolver = new FacetResolver(testDb, TEST_ACCOUNT_ID);
			const facetAccountId = await facetResolver.ensureFacet({
				kindSlug: "pain",
				label: "Too Slow",
				isActive: true,
			});

			if (!facetAccountId) throw new Error("Failed to create facet_account via FacetResolver");

			// evidence_facet says person 2 (MISMATCH!)
			await testDb.from("evidence_facet").insert({
				evidence_id: evidence.id,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				person_id: testPersonId2, // Different person!
				kind_slug: "pain",
				facet_account_id: facetAccountId,
				label: "Too Slow",
				source: "interview",
				confidence: 0.8,
			});

			// Validate parity - should FAIL
			const parityResult = await validateAttributionParity(testDb, testInterviewId, "trigger-v2");

			expect(parityResult.passed).toBe(false);
			expect(parityResult.mismatches).toBeGreaterThan(0);
		});

		it("should pass when evidence_facet and evidence_people are aligned", async () => {
			// Create evidence
			const { data: evidence } = await testDb
				.from("evidence")
				.insert({
					account_id: TEST_ACCOUNT_ID,
					project_id: TEST_PROJECT_ID,
					interview_id: testInterviewId,
					verbatim: "Test evidence",
					gist: "Test",
					chunk: "Test",
					source_type: "primary",
					method: "interview",
					modality: "qual",
				})
				.select("id")
				.single();

			if (!evidence) throw new Error("Failed to create test evidence");

			// Both say person 1
			await testDb.from("evidence_people").insert({
				evidence_id: evidence.id,
				person_id: testPersonId1,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				role: "speaker",
			});

			// Use FacetResolver to create facet_account
			const facetResolver = new FacetResolver(testDb, TEST_ACCOUNT_ID);
			const facetAccountId = await facetResolver.ensureFacet({
				kindSlug: "workflow",
				label: "Weekly Review",
				isActive: true,
			});

			if (!facetAccountId) throw new Error("Failed to create facet_account via FacetResolver");

			await testDb.from("evidence_facet").insert({
				evidence_id: evidence.id,
				account_id: TEST_ACCOUNT_ID,
				project_id: TEST_PROJECT_ID,
				person_id: testPersonId1, // Same person!
				kind_slug: "workflow",
				facet_account_id: facetAccountId,
				label: "Weekly Review",
				source: "interview",
				confidence: 0.8,
			});

			// Validate parity - should PASS
			const parityResult = await validateAttributionParity(testDb, testInterviewId, "trigger-v2");

			expect(parityResult.passed).toBe(true);
			expect(parityResult.mismatches).toBe(0);
		});
	});

	// TODO: Add tests for Desktop realtime path once we refactor the API route to be testable
	// TODO: Add tests for Desktop finalize path once we refactor the API route to be testable
	// TODO: Add tests for Legacy processInterview path after refactoring person resolution order
});
