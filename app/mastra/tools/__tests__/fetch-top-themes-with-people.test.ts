// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTopThemesWithPeopleTool } from "../fetch-top-themes-with-people";

type ToolResult = {
	success: boolean;
	message: string;
	projectId: string | null;
	totalThemes: number;
	topThemes: Array<{
		themeId: string;
		name: string;
		evidenceCount: number;
		peopleCount: number;
		people: Array<{
			personId: string;
			name: string | null;
			mentionCount: number;
			url: string | null;
		}>;
		url: string | null;
	}>;
};

const { mockSupabase } = vi.hoisted(() => ({
	mockSupabase: {
		from: vi.fn(),
	},
}));

vi.mock("~/lib/supabase/client.server", () => ({
	supabaseAdmin: mockSupabase,
}));

vi.mock("~/utils/route-definitions", () => ({
	createRouteDefinitions: vi.fn((projectPath: string) => ({
		themes: {
			detail: (themeId: string) => `${projectPath}/insights/${themeId}`,
		},
		people: {
			detail: (personId: string) => `${projectPath}/people/${personId}`,
		},
	})),
}));

vi.mock("~/paths", () => ({
	HOST: "http://localhost:4280",
}));

describe("fetchTopThemesWithPeopleTool", () => {
	beforeEach(() => {
		mockSupabase.from.mockReset();
	});

	it("returns missing project message when no project context is provided", async () => {
		const requestContext = new RequestContext();

		const result = (await fetchTopThemesWithPeopleTool.execute({}, { requestContext })) as ToolResult;

		expect(result.success).toBe(false);
		expect(result.message).toContain("Missing projectId");
		expect(result.topThemes).toEqual([]);
	});

	it("returns no themes when theme_evidence has no rows", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			if (table === "theme_evidence") {
				return {
					select: () => ({
						eq: () => Promise.resolve({ data: [], error: null }),
					}),
				};
			}
			throw new Error(`Unexpected table ${table}`);
		});

		const requestContext = new RequestContext();
		requestContext.set("project_id", "project-1");
		requestContext.set("account_id", "account-1");

		const result = (await fetchTopThemesWithPeopleTool.execute({ limit: 2 }, { requestContext })) as ToolResult;

		expect(result.success).toBe(true);
		expect(result.totalThemes).toBe(0);
		expect(result.topThemes).toEqual([]);
	});

	it("returns top themes with deterministic people attribution", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "theme_evidence":
					return {
						select: () => ({
							eq: () =>
								Promise.resolve({
									data: [
										{ theme_id: "theme-1", evidence_id: "ev-1" },
										{ theme_id: "theme-1", evidence_id: "ev-2" },
										{ theme_id: "theme-2", evidence_id: "ev-3" },
									],
									error: null,
								}),
						}),
					};
				case "themes":
					return {
						select: () => ({
							eq: () => ({
								in: () =>
									Promise.resolve({
										data: [
											{
												id: "theme-1",
												name: "Automation Demand",
												statement: "Users want less manual work.",
												updated_at: "2026-02-08T01:00:00.000Z",
											},
											{
												id: "theme-2",
												name: "Pricing Clarity",
												statement: "Buyers need clearer tiers.",
												updated_at: "2026-02-07T01:00:00.000Z",
											},
										],
										error: null,
									}),
							}),
						}),
					};
				case "evidence":
					return {
						select: () => {
							const builder: any = {};
							builder.in = () => builder;
							builder.is = () => builder;
							builder.eq = () =>
								Promise.resolve({
									data: [
										{ id: "ev-1", interview_id: "int-1" },
										{ id: "ev-2", interview_id: "int-2" },
										{ id: "ev-3", interview_id: "int-1" },
									],
									error: null,
								});
							return builder;
						},
					};
				case "evidence_facet":
					return {
						select: () => ({
							eq: () => ({
								in: () => ({
									not: () =>
										Promise.resolve({
											data: [{ evidence_id: "ev-1", person_id: "person-1" }],
											error: null,
										}),
								}),
							}),
						}),
					};
				case "evidence_people":
					return {
						select: () => ({
							eq: () => ({
								in: () =>
									Promise.resolve({
										data: [{ evidence_id: "ev-2", person_id: "person-2" }],
										error: null,
									}),
							}),
						}),
					};
				case "interview_people":
					return {
						select: () => ({
							eq: () => ({
								in: () =>
									Promise.resolve({
										data: [
											{ interview_id: "int-1", person_id: "person-3" },
											{ interview_id: "int-2", person_id: "person-2" },
										],
										error: null,
									}),
							}),
						}),
					};
				case "people":
					return {
						select: () => ({
							in: () =>
								Promise.resolve({
									data: [
										{ id: "person-1", name: "Alice" },
										{ id: "person-2", name: "Bob" },
										{ id: "person-3", name: "Carol" },
									],
									error: null,
								}),
						}),
					};
				default:
					throw new Error(`Unexpected table ${table}`);
			}
		});

		const requestContext = new RequestContext();
		requestContext.set("project_id", "project-1");
		requestContext.set("account_id", "account-1");

		const result = (await fetchTopThemesWithPeopleTool.execute(
			{ limit: 2, peoplePerTheme: 5 },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect(result.totalThemes).toBe(2);
		expect(result.topThemes).toHaveLength(2);
		expect(result.topThemes[0].name).toBe("Automation Demand");
		expect(result.topThemes[0].evidenceCount).toBe(2);
		expect(result.topThemes[0].peopleCount).toBe(3);
		expect(result.topThemes[0].people.map((person) => person.name)).toEqual(["Alice", "Carol", "Bob"]);
		expect(result.topThemes[0].url).toBe("http://localhost:4280/a/account-1/project-1/insights/theme-1");
	});
});
