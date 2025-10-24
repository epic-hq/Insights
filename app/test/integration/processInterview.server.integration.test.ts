import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb"

// Mock BAML client before importing processInterview
vi.mock("~/../baml_client", () => ({
	b: {
		ExtractEvidenceFromTranscript: vi.fn(),
		ExtractInsights: vi.fn(),
		AssignPersonaToInterview: vi.fn(),
	},
}))

import { b } from "~/../baml_client"
import { processInterviewTranscript } from "~/utils/processInterview.server"

// Get mocked functions after import
const mockExtractEvidence = b.ExtractEvidenceFromTranscript as ReturnType<typeof vi.fn>
const mockExtractInsights = b.ExtractInsights as ReturnType<typeof vi.fn>
const mockAssignPersona = b.AssignPersonaToInterview as ReturnType<typeof vi.fn>

/**
 * Integration test for processInterviewTranscript to verify:
 * 1. People records are created from interviewee data
 * 2. Personas are created from interviewee.persona
 * 3. Tags are created from insights.relatedTags arrays
 * 4. Junction tables are populated correctly
 */
describe("processInterviewTranscript Integration", () => {
	beforeEach(async () => {
		mockExtractEvidence.mockReset()
		mockExtractInsights.mockReset()
		mockAssignPersona.mockReset()
		mockAssignPersona.mockResolvedValue({ action: "assign_existing", persona_id: null, confidence_score: 0.4 } as any)
		mockExtractEvidence.mockResolvedValue({ facet_catalog_version: "test", evidence: [], people: [] } as any)
		mockExtractInsights.mockResolvedValue({ insights: [], interviewee: null } as any)
		await cleanupTestData()
		await seedTestData()
	})

	it("should create people, personas, and tags from interview upload", async () => {
		// Seed facet catalog for test account/project
		await testDb.from("facet_kind_global").upsert(
			[
				{ slug: "goal", label: "Goal", description: "Goals" },
				{ slug: "pain", label: "Pain", description: "Pains" },
				{ slug: "scale", label: "Scale", description: "Scales" },
			],
			{ onConflict: "slug" }
		)

		const { data: kindRows } = await testDb.from("facet_kind_global").select("id, slug")
		const kindIdBySlug = new Map((kindRows ?? []).map((row) => [row.slug, row.id]))

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
		)

		const { data: goalFacetRow } = await testDb
			.from("facet_global")
			.select("id, slug")
			.eq("slug", "goal_speed")
			.single()

		if (!goalFacetRow?.id) throw new Error("Failed to seed facet_global for integration test")

		await testDb.from("project_facet").upsert(
			{
				project_id: "test-project-id",
				account_id: TEST_ACCOUNT_ID,
				facet_ref: `g:${goalFacetRow.id}`,
				scope: "catalog",
				is_enabled: true,
				alias: "Speed Runner",
				pinned: true,
				sort_weight: 5,
			},
			{ onConflict: "project_id,facet_ref" }
		)

		// Mock BAML responses with realistic data
		const mockEvidenceResponse = {
			facet_catalog_version: "acct:test-account-123:proj:test-project-id:v123",
			evidence: [
				{
					person_key: "speaker-1",
					topic: "Needs",
					gist: "Wants to finish work faster",
					chunk: "I just need to finish these reports so much faster than today.",
					verbatim: "I need to finish reports faster.",
					headers: null,
					support: "supports",
					confidence: "high",
					supporting_details: null,
					facet_mentions: [
						{ kind_slug: "goal", value: "speed" },
						{ kind_slug: "workflow", value: "reports" },
					],
				},
			],
			people: [
				{
					person_key: "speaker-1",
					display_name: "Participant",
					role: "participant",
					facets: [
						{
							facet_ref: `g:${goalFacetRow.id}`,
							kind_slug: "goal",
							value: "Finish reports faster",
							source: "interview",
							evidence_unit_index: 0,
							confidence: 0.95,
						},
						{
							facet_ref: "",
							candidate: {
								kind_slug: "pain",
								label: "Manual Reporting",
								synonyms: ["spreadsheet toil"],
								notes: ["Spends hours on manual reporting"],
							},
							kind_slug: "pain",
							value: "Manual reporting is painful",
							source: "interview",
							evidence_unit_index: 0,
							confidence: 0.6,
						},
					],
					scales: [
						{
							kind_slug: "scale:efficiency",
							score: 0.8,
							band: "high",
							source: "interview",
							evidence_unit_index: 0,
							confidence: 0.9,
							rationale: "Repeatedly emphasized speed",
						},
					],
				},
			],
		}

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
			interviewee: {
				name: "John Smith",
				persona: "Product Manager",
				participantDescription: "Senior PM at tech company with 5 years experience",
				segment: "Professional",
				contactInfo: "john@company.com",
			},
			highImpactThemes: "Navigation and performance are key pain points",
			openQuestionsAndNextSteps: "Follow up on mobile performance metrics",
			observationsAndNotes: "User seemed frustrated with current state",
		}

		mockExtractEvidence.mockResolvedValue(mockEvidenceResponse as any)
		mockExtractInsights.mockResolvedValue(mockInsightsResponse as any)
		mockAssignPersona.mockResolvedValue({ action: "assign_existing", persona_id: null, confidence_score: 0.4 } as any)

		const mockRequest = new Request("http://localhost:3000/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		})

		const metadata = {
			accountId: TEST_ACCOUNT_ID,
			projectId: "test-project-id",
			interviewTitle: "User Research Session",
			interviewDate: "2025-01-25",
			fileName: "interview_john_smith.mp3",
		}

		const transcriptData = {
			full_transcript: "This is a test transcript with user feedback about navigation and performance issues.",
			duration: 1800, // 30 minutes
		}

		// Execute the function
		const result = await processInterviewTranscript({
			metadata,
			mediaUrl: "https://example.com/audio.mp3",
			transcriptData,
			userCustomInstructions: "Focus on UX issues",
			request: mockRequest,
		})

		// Verify interview was created
		expect(result.interview).toBeDefined()
		expect(result.interview.title).toBe("User Research Session")
		expect(result.interview.status).toBe("ready")

		// Verify insights were created
		expect(result.stored).toHaveLength(2)
		expect(result.stored[0].name).toBe("Navigation is confusing")
		expect(result.stored[1].name).toBe("Performance issues on mobile")

		// Verify person was created
		const { data: people } = await testDb
			.from("people")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("name", "John Smith")

		expect(people).toHaveLength(1)
		expect(people[0].name).toBe("John Smith")
		expect(people[0].segment).toBe("Professional")
		expect(people[0].contact_info).toBe("john@company.com")

		// Verify persona was created
		const { data: personas } = await testDb
			.from("personas")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("name", "Product Manager")

		expect(personas).toHaveLength(1)
		expect(personas[0].name).toBe("Product Manager")
		expect(personas[0].description).toContain("User Research Session")

		// Verify person is linked to persona
		expect(people[0].persona_id).toBe(personas[0].id)

		// Verify interview-people junction
		const { data: interviewPeople } = await testDb
			.from("interview_people")
			.select("*")
			.eq("interview_id", result.interview.id)
			.eq("person_id", people[0].id)

		expect(interviewPeople).toHaveLength(1)
		expect(interviewPeople[0].role).toBe("participant")

		// Verify tags were created from relatedTags arrays
		const expectedTags = ["navigation", "user_experience", "confusion", "performance", "mobile", "loading_speed"]
		const { data: tags } = await testDb
			.from("tags")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.in("tag", expectedTags)

		expect(tags).toHaveLength(6)
		const tagNames = tags.map((t) => t.tag).sort()
		expect(tagNames).toEqual(expectedTags.sort())

		// Verify insight-tag junction tables
		const { data: insightTags } = await testDb
			.from("insight_tags")
			.select("insight_id, tag_id")
			.in(
				"insight_id",
				result.stored.map((i) => i.id)
			)

		// Should have 6 total links (3 tags per insight)
		expect(insightTags).toHaveLength(6)

		// Verify persona-insight junction (should be created by trigger)
		const { data: personaInsights } = await testDb
			.from("persona_insights")
			.select("*")
			.eq("persona_id", personas[0].id)
			.in(
				"insight_id",
				result.stored.map((i) => i.id)
			)

		expect(personaInsights).toHaveLength(2)
		expect(personaInsights[0].relevance_score).toBe(1.0)

		// Verify facet persistence
		const { data: personFacets } = await testDb
			.from("person_facet")
			.select("person_id, facet_ref, confidence")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("project_id", "test-project-id")

		expect(personFacets).toEqual([
			{
				person_id: expect.any(String),
				facet_ref: `g:${goalFacetRow.id}`,
				confidence: 0.95,
			},
		])

		const { data: evidenceFacets } = await testDb
			.from("evidence_facet")
			.select("evidence_id, kind_slug, label, facet_ref")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("project_id", "test-project-id")

		expect(evidenceFacets).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind_slug: "goal",
					facet_ref: `g:${goalFacetRow.id}`,
					label: expect.any(String),
				}),
				expect.objectContaining({
					kind_slug: "workflow",
					facet_ref: null,
					label: expect.any(String),
				}),
			])
		)

		const { data: scaleRows } = await testDb
			.from("person_scale")
			.select("person_id, kind_slug, score, confidence")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("project_id", "test-project-id")

		expect(scaleRows).toEqual([
			{
				person_id: expect.any(String),
				kind_slug: "scale:efficiency",
				score: 0.8,
				confidence: 0.9,
			},
		])

		const { data: candidateRows } = await testDb
			.from("facet_candidate")
			.select("kind_slug, label, status")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("project_id", "test-project-id")

		expect(candidateRows).toEqual([
			{
				kind_slug: "pain",
				label: "Manual Reporting",
				status: "pending",
			},
		])
	})

	it("should handle missing persona gracefully", async () => {
		const mockInsights = {
			insights: [
				{
					name: "Test insight",
					category: "UX",
					relatedTags: ["test_tag"],
				},
			],
			interviewee: {
				name: "Jane Doe",
				persona: null,
				segment: "Student",
			},
			highImpactThemes: null,
			openQuestionsAndNextSteps: null,
			observationsAndNotes: null,
		}

		mockExtractInsights.mockResolvedValueOnce(mockInsights as any)
		mockExtractEvidence.mockResolvedValueOnce({ facet_catalog_version: "fallback", evidence: [], people: [] } as any)

		const mockRequest = new Request("http://localhost:3000/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		})

		const _result = await processInterviewTranscript({
			metadata: {
				accountId: TEST_ACCOUNT_ID,
				interviewTitle: "Test Interview",
			},
			mediaUrl: "https://example.com/audio.mp3",
			transcriptData: {
				full_transcript: "Test transcript",
				duration: 600,
			},
			request: mockRequest,
		})

		// Verify person was still created
		const { data: people } = await testDb
			.from("people")
			.select("*")
			.eq("account_id", TEST_ACCOUNT_ID)
			.eq("name", "Jane Doe")

		expect(people).toHaveLength(1)
		expect(people[0].persona_id).toBeNull() // No persona assigned

		// Verify no personas were created
		const { data: personas } = await testDb.from("personas").select("*").eq("account_id", TEST_ACCOUNT_ID)

		expect(personas).toHaveLength(0)
	})
})
