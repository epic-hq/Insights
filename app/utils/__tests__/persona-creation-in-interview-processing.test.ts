import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock environment variables first
vi.mock("../env.server", () => ({
	SUPABASE_URL: "https://test.supabase.co",
	SUPABASE_ANON_KEY: "test-key",
}))

// Mock consola
vi.mock("consola", () => ({
	default: {
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

// Mock createClient to return our mock
vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
		rpc: vi.fn().mockReturnThis(),
		data: null,
		error: null,
	})),
}))

// Mock supabaseAnon and supabaseAdmin
vi.mock("../../lib/supabase/server", () => ({
	supabaseAnon: {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
		rpc: vi.fn().mockReturnThis(),
		data: null,
		error: null,
	},
	supabaseAdmin: {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
		rpc: vi.fn().mockReturnThis(),
		data: null,
		error: null,
	},
	getServerClient: vi.fn(() => ({
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		single: vi.fn().mockReturnThis(),
		rpc: vi.fn().mockReturnThis(),
		data: null,
		error: null,
	})),
}))

// Mock the BAML client module
vi.mock("~/../baml_client", () => ({
	b: {
		ExtractEvidenceFromTranscript: vi.fn().mockReturnValue([
			{
				verbatim: "I really like the product but the onboarding was confusing.",
				support: "User expressed positive sentiment about the product overall.",
				confidence: 0.85,
			},
		]),
		ExtractInsightsFromTranscript: vi.fn().mockReturnValue([
			{
				insight: "Users find the product valuable but struggle with onboarding.",
				relatedTags: ["onboarding", "user experience"],
				confidence: 0.9,
				severity: "medium",
				frequency: "high",
			},
		]),
		AssignPersonaToInterview: vi.fn().mockReturnValue({
			action: "create_new",
			confidence_score: 0.85,
			reasoning: "This interviewee represents a new user segment not covered by existing personas.",
			new_persona_data: {
				name: "Tech-Savvy Professional",
				description: "Experienced professional who values efficiency and clear workflows.",
				color_hex: "#4A90E2",
				demographics: {
					age_range: "30-45",
					occupation: "Product Manager",
					education: "Masters degree",
				},
				goals: ["Improve team productivity", "Streamline workflows"],
				pain_points: ["Complex onboarding processes", "Unclear documentation"],
			},
		}),
	},
}))

// Import after mocks
import { processInterviewTranscript } from "../processInterview.server"

describe("Persona Creation in Interview Processing", () => {
	// Get references to the mocked objects after they've been initialized
	let mockSupabaseAnon: any
	let mockBamlClient: any

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()
		
		// Get references to the mocked objects
		mockSupabaseAnon = vi.mocked(require("../../lib/supabase/server").supabaseAnon)
		mockBamlClient = vi.mocked(require("~/../baml_client").b)
		
		// Default successful responses
		mockSupabaseAnon.data = { id: "test-id" }
		mockSupabaseAnon.error = null
		
		// Mock the personas query to return empty array (no existing personas)
		mockSupabaseAnon.from.mockImplementation((table) => {
			if (table === "personas") {
				mockSupabaseAnon.data = []
			}
			return mockSupabaseAnon
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("should create a new persona and link it to the person during interview processing", async () => {
		// Mock interview data
		const interviewData = {
			transcript: "This is a test transcript. I really like the product but the onboarding was confusing.",
			metadata: {
				accountId: "test-account-id",
				projectId: "test-project-id",
				userId: "test-user-id",
			},
			interviewee: {
				name: "John Doe",
				segment: "Enterprise",
				participantDescription: "Product manager at a tech company",
			},
		}

		// Mock the insert responses
		const mockInsertResponses = new Map([
			["interviews", { data: { id: "test-interview-id" }, error: null }],
			["evidence", { data: [{ id: "test-evidence-id" }], error: null }],
			["people", { data: { id: "test-person-id" }, error: null }],
			["evidence_people", { data: null, error: null }],
			["interview_people", { data: null, error: null }],
			["personas", { data: { id: "test-persona-id" }, error: null }],
			["people_personas", { data: null, error: null }],
			["insights", { data: [{ id: "test-insight-id" }], error: null }],
			["insight_tags", { data: null, error: null }],
		])

		// Setup mock implementation for database operations
		mockSupabase.from.mockImplementation((table) => {
			if (mockInsertResponses.has(table)) {
				const response = mockInsertResponses.get(table)
				mockSupabase.data = response?.data
				mockSupabase.error = response?.error
			}
			return mockSupabase
		})

		// Mock select to return a single result for .single() calls
		mockSupabase.single.mockImplementation(() => {
			return mockInsertResponses.get("personas") || { data: null, error: null }
		})

		// Process the interview
		await processInterviewTranscript({
			transcriptData: interviewData.transcript,
			metadata: interviewData.metadata,
			interviewee: interviewData.interviewee
		})

		// Verify persona was created
		const personaInsertCall = mockSupabase.from.mock.calls.find(
			(call) => call[0] === "personas"
		)
		expect(personaInsertCall).toBeTruthy()
		
		// Verify the persona was linked to the person
		const peoplePesonasInsertCall = mockSupabase.from.mock.calls.find(
			(call) => call[0] === "people_personas"
		)
		expect(peoplePesonasInsertCall).toBeTruthy()
		
		// Verify the insert parameters for people_personas
		const peoplePersonasInsertParams = mockSupabase.insert.mock.calls.find(
			(call) => {
				return call[0] && 
					call[0].person_id === "test-person-id" && 
					call[0].persona_id === "test-persona-id"
			}
		)
		expect(peoplePersonasInsertParams).toBeTruthy()
		if (peoplePersonasInsertParams) {
			expect(peoplePersonasInsertParams[0]).toMatchObject({
				person_id: "test-person-id",
				persona_id: "test-persona-id",
				interview_id: "test-interview-id",
				project_id: "test-project-id",
				source: "ai_assignment",
			})
			expect(peoplePersonasInsertParams[0].confidence_score).toBeGreaterThan(0)
		}
	})

	it("should assign to an existing persona when BAML recommends it", async () => {
		// Override the BAML mock for this test
		mockBamlClient.AssignPersonaToInterview.mockReturnValueOnce({
			action: "assign_existing",
			persona_id: "existing-persona-id",
			persona_name: "Existing Persona",
			confidence_score: 0.92,
			reasoning: "This interviewee matches an existing persona profile.",
		}))

		// Mock interview data
		const interviewData = {
			transcript: "This is a test transcript. I really like the product but the onboarding was confusing.",
			metadata: {
				accountId: "test-account-id",
				projectId: "test-project-id",
				userId: "test-user-id",
			},
			interviewee: {
				name: "Jane Smith",
				segment: "SMB",
				participantDescription: "Marketing director at a mid-size company",
			},
		}

		// Mock the insert responses
		const mockInsertResponses = new Map([
			["interviews", { data: { id: "test-interview-id-2" }, error: null }],
			["evidence", { data: [{ id: "test-evidence-id-2" }], error: null }],
			["people", { data: { id: "test-person-id-2" }, error: null }],
			["evidence_people", { data: null, error: null }],
			["interview_people", { data: null, error: null }],
			["personas", { data: [{ id: "existing-persona-id", name: "Existing Persona", description: "An existing persona" }], error: null }],
			["people_personas", { data: null, error: null }],
			["insights", { data: [{ id: "test-insight-id-2" }], error: null }],
			["insight_tags", { data: null, error: null }],
		])

		// Setup mock implementation for database operations
		mockSupabase.from.mockImplementation((table) => {
			if (mockInsertResponses.has(table)) {
				const response = mockInsertResponses.get(table)
				mockSupabase.data = response?.data
				mockSupabase.error = response?.error
			}
			return mockSupabase
		})

		// Process the interview
		await processInterviewTranscript({
			transcriptData: interviewData.transcript,
			metadata: interviewData.metadata,
			interviewee: interviewData.interviewee
		})

		// Verify no new persona was created (personas table should not be inserted into)
		const personaInsertCalls = mockSupabase.insert.mock.calls.filter(
			() => mockSupabase.from.mock.calls.find((fromCall) => fromCall[0] === "personas")
		)
		expect(personaInsertCalls.length).toBe(0)
		
		// Verify the person was linked to the existing persona
		const peoplePersonasInsertParams = mockSupabase.insert.mock.calls.find(
			(call) => {
				return call[0] && 
					call[0].person_id === "test-person-id-2" && 
					call[0].persona_id === "existing-persona-id"
			}
		)
		expect(peoplePersonasInsertParams).toBeTruthy()
		if (peoplePersonasInsertParams) {
			expect(peoplePersonasInsertParams[0]).toMatchObject({
				person_id: "test-person-id-2",
				persona_id: "existing-persona-id",
				interview_id: "test-interview-id-2",
				project_id: "test-project-id",
				source: "ai_assignment",
			})
			expect(peoplePersonasInsertParams[0].confidence_score).toBeCloseTo(0.92)
		}
	})

	it("should handle errors during persona assignment gracefully", async () => {
		// Override the BAML mock to throw an error
		mockBamlClient.AssignPersonaToInterview.mockImplementationOnce(() => {
			throw new Error("BAML service unavailable")
		})

		// Mock interview data
		const interviewData = {
			transcript: "This is a test transcript with an error.",
			metadata: {
				accountId: "test-account-id",
				projectId: "test-project-id",
				userId: "test-user-id",
			},
			interviewee: {
				name: "Error Test",
				segment: "Enterprise",
			},
		}

		// Mock the insert responses
		const mockInsertResponses = new Map([
			["interviews", { data: { id: "test-interview-id-3" }, error: null }],
			["evidence", { data: [{ id: "test-evidence-id-3" }], error: null }],
			["people", { data: { id: "test-person-id-3" }, error: null }],
			["evidence_people", { data: null, error: null }],
			["interview_people", { data: null, error: null }],
			["insights", { data: [{ id: "test-insight-id-3" }], error: null }],
			["insight_tags", { data: null, error: null }],
		])

		// Setup mock implementation for database operations
		mockSupabase.from.mockImplementation((table) => {
			if (mockInsertResponses.has(table)) {
				const response = mockInsertResponses.get(table)
				mockSupabase.data = response?.data
				mockSupabase.error = response?.error
			}
			return mockSupabase
		})

		// Process the interview - should not throw despite BAML error
		await expect(
			processInterviewTranscript({
				transcriptData: interviewData.transcript,
				metadata: interviewData.metadata,
				interviewee: interviewData.interviewee
			})
		).resolves.not.toThrow()

		// Verify the rest of the process completed
		const insightsInsertCall = mockSupabase.from.mock.calls.find(
			(call) => call[0] === "insights"
		)
		expect(insightsInsertCall).toBeTruthy()
	})
})
