import { beforeEach, describe, expect, it } from "vitest"
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, testDb } from "~/test/utils/testDb"
import { processInterviewTranscript } from "./processInterview.server"

/**
 * Integration test for processInterviewTranscript to verify:
 * 1. People records are created from interviewee data
 * 2. Personas are created from interviewee.persona
 * 3. Tags are created from insights.relatedTags arrays
 * 4. Junction tables are populated correctly
 */
describe("processInterviewTranscript Integration", () => {
	beforeEach(async () => {
		await cleanupTestData()
		await seedTestData()
	})

	it("should create people, personas, and tags from interview upload", async () => {
		// Mock BAML response with realistic data
		const mockBAMLResponse = {
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

		// Mock the BAML client
		const originalExtractInsights = (await import("~/../baml_client")).b.ExtractInsights
		const mockExtractInsights = vi.fn().mockResolvedValue(mockBAMLResponse)
		vi.doMock("~/../baml_client", () => ({
			b: { ExtractInsights: mockExtractInsights },
		}))

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

		// Restore original function
		vi.doUnmock("~/../baml_client")
	})

	it("should handle missing persona gracefully", async () => {
		const mockBAMLResponse = {
			insights: [
				{
					name: "Test insight",
					category: "UX",
					relatedTags: ["test_tag"],
				},
			],
			interviewee: {
				name: "Jane Doe",
				persona: null, // No persona provided
				segment: "Student",
			},
			highImpactThemes: null,
			openQuestionsAndNextSteps: null,
			observationsAndNotes: null,
		}

		const mockExtractInsights = vi.fn().mockResolvedValue(mockBAMLResponse)
		vi.doMock("~/../baml_client", () => ({
			b: { ExtractInsights: mockExtractInsights },
		}))

		const mockRequest = new Request("http://localhost:3000/api/upload", {
			method: "POST",
			headers: { Authorization: "Bearer test-token" },
		})

		const result = await processInterviewTranscript({
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

		vi.doUnmock("~/../baml_client")
	})
})
