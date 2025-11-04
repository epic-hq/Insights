// @vitest-environment node

import { RuntimeContext } from "@mastra/core/di"
import { describe, expect, it, vi, beforeEach } from "vitest"
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

	it("returns account mismatch message when project belongs to different account", async () => {
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

		const runtimeContext = new RuntimeContext()
		runtimeContext.set("account_id", "account-123")

		const result = await fetchProjectStatusContextTool.execute({
			context: { projectId: "project-123", scopes: ["status"] },
			runtimeContext,
		})

		expect(result.success).toBe(false)
		expect(result.message).toContain("Project is not accessible")
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
})
