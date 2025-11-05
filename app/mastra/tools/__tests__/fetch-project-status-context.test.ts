// @vitest-environment node

import { RuntimeContext } from "@mastra/core/di"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchProjectStatusContextTool } from "../fetch-project-status-context"

const mockSupabase = {
	from: vi.fn(),
}

const getProjectStatusDataMock = vi.fn()

vi.mock("~/lib/supabase/client.server", () => ({
	supabaseAdmin: mockSupabase,
}))

vi.mock("~/utils/project-status.server", () => ({
	getProjectStatusData: getProjectStatusDataMock,
}))

describe("fetchProjectStatusContextTool", () => {
	beforeEach(() => {
		mockSupabase.from.mockReset()
		getProjectStatusDataMock.mockReset()
	})

	it("returns missing project message when no project context provided", async () => {
		const runtimeContext = new RuntimeContext()
		runtimeContext.set("account_id", "account-123")

		const result = await fetchProjectStatusContextTool.execute({
			context: {},
			runtimeContext,
		})

		expect(result.success).toBe(false)
		expect(result.message).toContain("Missing projectId")
	})

	it("loads status even when runtime account differs from project account", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			if (table !== "projects") throw new Error(`Unexpected table ${table}`)
			return {
				select: () => ({
					eq: () => ({
						maybeSingle: () =>
							Promise.resolve({
								data: {
									id: "project-123",
									account_id: "other-account",
									name: "Test Project",
									description: null,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								},
								error: null,
							}),
					}),
				}),
			}
		})

		getProjectStatusDataMock.mockResolvedValue(null)

		const runtimeContext = new RuntimeContext()
		runtimeContext.set("account_id", "account-123")

		const result = await fetchProjectStatusContextTool.execute({
			context: { projectId: "project-123", scopes: ["status"] },
			runtimeContext,
		})

		expect(result.success).toBe(true)
		expect(result.message).toContain("Loaded project status context")
		expect(result.data?.status).toBeUndefined()
	})

	it("returns status data when project accessible and status scope requested", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			if (table !== "projects") throw new Error(`Unexpected table ${table}`)
			return {
				select: () => ({
					eq: () => ({
						maybeSingle: () =>
							Promise.resolve({
								data: {
									id: "project-123",
									account_id: "account-123",
									name: "Test Project",
									description: null,
									created_at: new Date().toISOString(),
									updated_at: new Date().toISOString(),
								},
								error: null,
							}),
					}),
				}),
			}
		})

		getProjectStatusDataMock.mockResolvedValue({
			projectName: "Test Project",
			icp: "ICP",
			totalInterviews: 2,
			totalInsights: 3,
			totalPersonas: 1,
			totalThemes: 1,
			totalEvidence: 4,
			answeredQuestions: ["What problem are we solving?"],
			openQuestions: [],
			keyInsights: ["Customers struggle with X"],
			completionScore: 80,
			lastUpdated: new Date(),
			analysisId: "analysis-1",
			hasAnalysis: true,
			nextSteps: ["Interview more users"],
			nextAction: "Run more interviews",
			keyDiscoveries: ["Discovery A"],
			confidenceScore: 0.75,
			confidenceLevel: 0.65,
			followUpRecommendations: ["Recommendation"],
			suggestedInterviewTopics: ["Topic A"],
			answeredInsights: ["Insight A"],
			unanticipatedDiscoveries: ["Discovery B"],
			criticalUnknowns: ["Unknown A"],
			questionAnswers: [],
		})

		const runtimeContext = new RuntimeContext()
		runtimeContext.set("account_id", "account-123")

		const result = await fetchProjectStatusContextTool.execute({
			context: { projectId: "project-123", scopes: ["status"] },
			runtimeContext,
		})

		expect(result.success).toBe(true)
		expect(result.data?.status?.projectName).toBe("Test Project")
		expect(getProjectStatusDataMock).toHaveBeenCalledWith("project-123", mockSupabase)
	})

	it("returns people evidence when searching for a specific person", async () => {
		const now = new Date().toISOString()
		const projectRow = {
			id: "project-123",
			account_id: "account-abc",
			name: "Test Project",
			description: null,
			created_at: now,
			updated_at: now,
		}
		const peopleRows = [
			{
				id: "pp-1",
				person_id: "person-1",
				role: "Buyer",
				interview_count: 2,
				first_seen_at: now,
				last_seen_at: now,
				created_at: now,
				updated_at: now,
				person: {
					id: "person-1",
					name: "Jane Doe",
					segment: "Freelancer",
					role: "Founder",
					title: null,
					company: null,
					description: null,
					location: null,
					image_url: null,
					contact_info: null,
					people_personas: [],
				},
			},
		]
		const interviewPeopleRows = [
			{
				person_id: "person-1",
				interview_id: "interview-1",
				interview: {
					id: "interview-1",
					title: "Kickoff Interview",
					interview_date: now,
					status: "completed",
				},
			},
		]
		const evidenceRows = [
			{
				id: "evidence-1",
				gist: "Jane highlighted onboarding pain.",
				verbatim: "The onboarding flow takes me 3 tries every time.",
				context_summary: null,
				modality: "transcript",
				created_at: now,
				interview_id: "interview-1",
			},
		]

		let recordedOrClause: string | undefined

		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "projects":
					return {
						select: () => ({
							eq: () => ({
								maybeSingle: () => Promise.resolve({ data: projectRow, error: null }),
							}),
						}),
					}
				case "project_people": {
					const builder: any = {}
					builder.select = () => builder
					builder.eq = () => builder
					builder.or = (clause: string) => {
						recordedOrClause = clause
						return builder
					}
					builder.order = () => ({
						limit: () => Promise.resolve({ data: peopleRows, error: null }),
					})
					return builder
				}
				case "interview_people": {
					const builder: any = {}
					builder.select = () => builder
					builder.eq = () => builder
					builder.in = () => builder
					builder.order = () => Promise.resolve({ data: interviewPeopleRows, error: null })
					return builder
				}
				case "evidence": {
					const builder: any = {}
					builder.select = () => builder
					builder.eq = () => builder
					builder.in = () => builder
					builder.order = () => ({
						limit: () => Promise.resolve({ data: evidenceRows, error: null }),
					})
					return builder
				}
				default:
					throw new Error(`Unexpected table ${table}`)
			}
		})

		const runtimeContext = new RuntimeContext()
		runtimeContext.set("account_id", "account-123")

		const result = await fetchProjectStatusContextTool.execute({
			context: { projectId: "project-123", scopes: ["people"], peopleSearch: "Jane Doe" },
			runtimeContext,
		})

		expect(result.success).toBe(true)
		expect(recordedOrClause).toContain("person.name.ilike.*Jane Doe*")
		expect(getProjectStatusDataMock).not.toHaveBeenCalled()
		const person = result.data?.people?.[0]
		expect(person?.name).toBe("Jane Doe")
		expect(person?.evidence?.[0]?.verbatim).toBe("The onboarding flow takes me 3 tries every time.")
		expect(person?.interviews?.[0]?.title).toBe("Kickoff Interview")
	})
})
