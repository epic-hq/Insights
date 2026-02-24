// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { describe, expect, it, vi } from "vitest";

const { determineProjectStageMock, generateRecommendationsMock, getProjectResearchContextMock } = vi.hoisted(() => ({
	determineProjectStageMock: vi.fn(),
	generateRecommendationsMock: vi.fn(),
	getProjectResearchContextMock: vi.fn(),
}));

vi.mock("../../../lib/supabase/client.server", () => ({
	supabaseAdmin: {},
}));

vi.mock("../../../features/research-links/db", () => ({
	getProjectResearchContext: getProjectResearchContextMock,
}));

vi.mock("../../../features/research-links/utils/recommendation-rules", () => ({
	determineProjectStage: determineProjectStageMock,
	generateRecommendations: generateRecommendationsMock,
}));

vi.mock("../../../utils/route-definitions", () => ({
	createRouteDefinitions: vi.fn((projectPath: string) => ({
		projects: {
			setup: () => `${projectPath}/setup`,
		},
		ask: {
			new: () => `${projectPath}/ask/new`,
		},
		themes: {
			index: () => `${projectPath}/themes`,
			detail: (themeId: string) => `${projectPath}/themes/${themeId}`,
		},
		people: {
			index: () => `${projectPath}/people`,
		},
	})),
}));

import { recommendNextActionsTool } from "../recommend-next-actions";

describe("recommendNextActionsTool", () => {
	it("renders ProgressRail for status/progress reasons", async () => {
		getProjectResearchContextMock.mockResolvedValue({
			interviewCount: 2,
			surveyCount: 1,
			themes: [{ id: "theme-1", name: "Onboarding friction" }],
			hasGoals: true,
			dataQuality: {
				peopleNeedingSegments: 0,
				totalPeople: 4,
				peopleWithoutTitles: 1,
			},
		});
		generateRecommendationsMock.mockReturnValue([]);
		determineProjectStageMock.mockReturnValue("validation");

		const requestContext = new RequestContext();
		requestContext.set("project_id", "project-1");
		requestContext.set("account_id", "account-1");

		const result = await recommendNextActionsTool.execute(
			{
				reason: "User asked for project state and progress",
			},
			{ requestContext }
		);

		expect(result.success).toBe(true);
		expect(result.a2ui).toBeDefined();

		const surfaceUpdate = result.a2ui?.messages?.find((message) => message.type === "surfaceUpdate");
		const firstComponent = surfaceUpdate?.components?.[0];
		expect(firstComponent).toBeDefined();
		expect(Object.keys(firstComponent?.component ?? {})).toContain("ProgressRail");
	});

	it("renders DecisionSupport for recommendation requests", async () => {
		getProjectResearchContextMock.mockResolvedValue({
			interviewCount: 5,
			surveyCount: 2,
			themes: [{ id: "theme-1", name: "Pricing confusion" }],
			hasGoals: true,
			dataQuality: {
				peopleNeedingSegments: 1,
				totalPeople: 10,
				peopleWithoutTitles: 2,
			},
		});
		generateRecommendationsMock.mockReturnValue([
			{
				id: "next-1",
				priority: 1,
				title: "Validate top pricing concern",
				description: "Run 2 follow-up interviews on pricing objections.",
				reasoning: "Pricing theme appears in multiple interviews.",
				actionType: "validate",
				navigateTo: "/themes/theme-1",
				focusTheme: { id: "theme-1", name: "Pricing confusion" },
			},
		]);
		determineProjectStageMock.mockReturnValue("synthesis");

		const requestContext = new RequestContext();
		requestContext.set("project_id", "project-1");
		requestContext.set("account_id", "account-1");

		const result = await recommendNextActionsTool.execute(
			{
				reason: "User asked what to do next",
			},
			{ requestContext }
		);

		expect(result.success).toBe(true);
		expect(result.recommendations).toHaveLength(1);
		expect(result.a2ui).toBeDefined();

		const surfaceUpdate = result.a2ui?.messages?.find((message) => message.type === "surfaceUpdate");
		const firstComponent = surfaceUpdate?.components?.[0];
		expect(Object.keys(firstComponent?.component ?? {})).toContain("DecisionSupport");
	});
});
