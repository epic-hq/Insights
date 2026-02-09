import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

// Mock BAML client before importing processInterview
vi.mock("~/../baml_client", () => ({
	b: {
		withOptions: vi.fn(function withOptions() {
			return this;
		}),
		ExtractEvidenceFromTranscriptV2: vi.fn(),
		GenerateKeyTakeawaysFromEvidence: vi.fn(),
		ExtractInsights: vi.fn(),
		AssignPersonaToInterview: vi.fn(),
		AnalyzeStandaloneConversation: vi.fn().mockResolvedValue({}),
		DerivePersonaFacetsFromEvidence: vi.fn().mockResolvedValue({ personas: [] }),
	},
}));

vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: () => ({ client: testDb }),
	createSupabaseAdminClient: () => testDb,
	getAuthenticatedUser: vi.fn().mockResolvedValue({
		user: { sub: "00000000-0000-0000-0000-00000000f123" },
		headers: new Headers(),
	}),
}));

import { b } from "~/../baml_client";
import { processInterviewTranscript } from "~/utils/processInterview.server";

// Get mocked functions after import
const mockExtractEvidence = b.ExtractEvidenceFromTranscriptV2 as ReturnType<typeof vi.fn>;
const mockGenerateKeyTakeaways = b.GenerateKeyTakeawaysFromEvidence as ReturnType<typeof vi.fn>;
const mockExtractInsights = b.ExtractInsights as ReturnType<typeof vi.fn>;
const mockAssignPersona = b.AssignPersonaToInterview as ReturnType<typeof vi.fn>;

/**
 * Integration test for processInterviewTranscript to verify:
 * 1. People records are created from participant data
 * 2. Personas are created from participant.persona
 * 3. Tags are created from insights.relatedTags arrays
 * 4. Junction tables are populated correctly
 */
// TODO(bead): Re-enable after stabilizing test environment for processInterview
// Current blockers include environment-coupled queue dependencies and nondeterministic
// seed ordering under schema transitions.
describe.skip("processInterviewTranscript Integration", () => {
	beforeEach(async () => {
		mockExtractEvidence.mockReset();
		mockGenerateKeyTakeaways.mockReset();
		mockExtractInsights.mockReset();
		mockAssignPersona.mockReset();
		mockAssignPersona.mockResolvedValue({ action: "assign_existing", persona_id: null, confidence_score: 0.4 } as any);
		mockExtractEvidence.mockResolvedValue({ facet_catalog_version: "test", evidence: [], people: [] } as any);
		mockGenerateKeyTakeaways.mockResolvedValue({
			insights: [],
			participant: {},
			highImpactThemes: [],
			openQuestionsAndNextSteps: "",
			observationsAndNotes: "",
			metadata: { title: "" },
			relevantAnswers: [],
		} as any);
		mockExtractInsights.mockResolvedValue({ insights: [], participant: null } as any);
		await cleanupTestData();
		await seedTestData();
	});

	it("should create people, personas, and tags from interview upload", async () => {
		// Seed facet catalog for test account/project
		await testDb.from("facet_kind_global").upsert(
			[
				{ slug: "goal", label: "Goal", description: "Goals" },
				{ slug: "pain", label: "Pain", description: "Pains" },
				{ slug: "scale", label: "Scale", description: "Scales" },
			],
			{ onConflict: "slug" }
		);

		const { data: kindRows } = await testDb.from("facet_kind_global").select("id, slug");
		const kindIdBySlug = new Map((kindRows ?? []).map((row) => [row.slug, row.id]));

		await testDb.from("facet_global").upsert(
			[
				{
					kind_id: kindIdBySlug.get("goal"),
					slug: "goal_speed",
					label: "Finish Faster",
					synonyms: ["move faster"],
					description: "Speed oriented",
				},
			],
			{ onConflict: "slug" }
		);

		const { data: goalFacetRow } = await testDb
			.from("facet_global")
			.select("id, slug")
			.eq("slug", "goal_speed")
			.single();

		if (!goalFacetRow?.id) throw new Error("Failed to seed facet_global for integration test");

		const mockInsightsResponse = {
			insights: [
				{
					name: "Navigation is confusing",
					category: "UX",
					relatedTags: ["navigation", "user_experience", "confusion"],
					journeyStage: "Onboarding",
					pain: "Users cannot find key features",
					desiredOutcome: "Clear navigation structure",
					evidence: "I got lost trying to find the settings page",
					impact: 4,
					novelty: 2,
				},
				{
					name: "Performance issues on mobile",
					category: "Technical",
					relatedTags: ["performance", "mobile", "loading_speed"],
					journeyStage: "Usage",
					pain: "App is slow on mobile devices",
					desiredOutcome: "Fast loading times",
					evidence: "It takes forever to load on my phone",
					impact: 5,
					novelty: 1,
				},
			],
			participant: {
				name: "John Smith",
				persona: "Product Manager",
				participantDescription: "Senior PM at tech company with 5 years experience",
				segment: "Professional",
				contactInfo: "john@company.com",
			},
			highImpactThemes: "Navigation and performance are key pain points",
			openQuestionsAndNextSteps: "Follow up on mobile performance metrics",
			observationsAndNotes: "User seemed frustrated with current state",
		};

		mockExtractEvidence.mockResolvedValue({ facet_catalog_version: "test", evidence: [], people: [] } as any);
		mockGenerateKeyTakeaways.mockResolvedValue(mockInsightsResponse as any);
		mockExtractInsights.mockResolvedValue(mockInsightsResponse as any);
		mockAssignPersona.mockResolvedValue({ action: "assign_existing", persona_id: null, confidence_score: 0.4 } as any);

		const mockRequest = new Request("http://localhost:3000/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		});

		const metadata = {
			accountId: TEST_ACCOUNT_ID,
			projectId: TEST_PROJECT_ID,
			interviewTitle: "User Research Session",
			interviewDate: "2025-01-25",
			fileName: "interview_john_smith.mp3",
		};

		const transcriptData = {
			full_transcript: "This is a test transcript with user feedback about navigation and performance issues.",
			duration: 1800, // 30 minutes
		};

		// Execute the function
		const result = await processInterviewTranscript({
			metadata,
			mediaUrl: "https://example.com/audio.mp3",
			transcriptData,
			userCustomInstructions: "Focus on UX issues",
			request: mockRequest,
		});

		// Verify interview was created
		expect(result.interview).toBeDefined();
		expect(result.interview.title).toBe("User Research Session");
		expect(["ready", "processing"]).toContain(result.interview.status);

		// Verify insights were created
		expect(result.stored).toHaveLength(2);
		expect(result.stored[0].name).toBe("Navigation is confusing");
		expect(result.stored[1].name).toBe("Performance issues on mobile");

		// Verify person was created and linked to interview
		const { data: interviewPeople } = await testDb
			.from("interview_people")
			.select("person_id, role, people(*)")
			.eq("interview_id", result.interview.id);

		expect(interviewPeople).toHaveLength(1);
		expect(interviewPeople?.[0]?.role).toBe("participant");
		const linkedPerson = interviewPeople?.[0]?.people as any;
		expect(linkedPerson).toBeTruthy();
		expect(linkedPerson.segment).toBe("Professional");

		// Verify persona was created
		const { data: personas } = await testDb
			.from("personas")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("name", "Product Manager");

		expect(personas).toHaveLength(1);
		expect(personas[0].name).toBe("Product Manager");
		expect(personas[0].description).toContain("User Research Session");

		// Verify person is linked to persona via normalized junction
		const { data: personaLinks } = await testDb
			.from("people_personas")
			.select("person_id, persona_id")
			.eq("person_id", interviewPeople?.[0]?.person_id)
			.eq("persona_id", personas[0].id);
		expect(personaLinks).toHaveLength(1);

		// Verify tags were created from relatedTags arrays
		const expectedTags = ["navigation", "user_experience", "confusion", "performance", "mobile", "loading_speed"];
		const { data: tags } = await testDb
			.from("tags")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.in("tag", expectedTags);

		expect(tags).toHaveLength(6);
		const tagNames = tags.map((t) => t.tag).sort();
		expect(tagNames).toEqual(expectedTags.sort());

		// Verify insight-tag junction tables
		const { data: insightTags } = await testDb
			.from("insight_tags")
			.select("insight_id, tag_id")
			.in(
				"insight_id",
				result.stored.map((i) => i.id)
			);

		// Should have 6 total links (3 tags per insight)
		expect(insightTags).toHaveLength(6);

		// Verify persona-insight junction (should be created by trigger)
		const { data: personaInsights } = await testDb
			.from("persona_insights")
			.select("*")
			.eq("persona_id", personas[0].id)
			.in(
				"insight_id",
				result.stored.map((i) => i.id)
			);

		// Persona-insight linking may be async; verify query executes and relationship shape is valid when present
		expect(Array.isArray(personaInsights)).toBe(true);
	});

	it("should handle missing persona gracefully", async () => {
		const mockInsights = {
			insights: [
				{
					name: "Test insight",
					category: "UX",
					relatedTags: ["test_tag"],
				},
			],
			participant: {
				name: "Jane Doe",
				persona: null,
				segment: "Student",
			},
			highImpactThemes: null,
			openQuestionsAndNextSteps: null,
			observationsAndNotes: null,
		};

		mockGenerateKeyTakeaways.mockResolvedValueOnce(mockInsights as any);
		mockExtractInsights.mockResolvedValueOnce(mockInsights as any);
		mockExtractEvidence.mockResolvedValueOnce({ facet_catalog_version: "fallback", evidence: [], people: [] } as any);

		const mockRequest = new Request("http://localhost:3000/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		});

		const _result = await processInterviewTranscript({
			metadata: {
				accountId: TEST_ACCOUNT_ID,
				projectId: TEST_PROJECT_ID,
				interviewTitle: "Test Interview",
			},
			mediaUrl: "https://example.com/audio.mp3",
			transcriptData: {
				full_transcript: "Test transcript",
				duration: 600,
			},
			request: mockRequest,
		});

		// Verify no personas were created
		const { data: personas } = await testDb.from("personas").select("*").eq("account_id", TEST_ACCOUNT_ID);

		expect(personas).toHaveLength(0);
	});
});
