// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchProjectStatusContextTool } from "../fetch-project-status-context";

// Type for expected tool result (excluding ValidationError)
type ToolResult = {
	success: boolean;
	message: string;
	scopes: string[];
	projectId?: string | null;
	projectName?: string | null;
	data?: Record<string, unknown>;
};

const { mockSupabase, getProjectStatusDataMock } = vi.hoisted(() => ({
	mockSupabase: {
		from: vi.fn(),
		schema: vi.fn(),
	},
	getProjectStatusDataMock: vi.fn(),
}));

vi.mock("~/lib/supabase/client.server", () => ({
	supabaseAdmin: mockSupabase,
}));

vi.mock("~/utils/project-status.server", () => ({
	getProjectStatusData: getProjectStatusDataMock,
}));

describe("fetchProjectStatusContextTool", () => {
	beforeEach(() => {
		mockSupabase.from.mockReset();
		mockSupabase.schema.mockReset();
		getProjectStatusDataMock.mockReset();

		mockSupabase.schema.mockReturnValue({
			from: vi.fn().mockReturnValue({
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
					}),
				}),
			}),
		});
	});

	it("returns missing project message when no project context provided", async () => {
		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute({}, { requestContext })) as ToolResult;

		expect(result.success).toBe(false);
		expect(result.message).toContain("Missing projectId");
	});

	it("loads status even when runtime account differs from project account", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			if (table !== "projects") throw new Error(`Unexpected table ${table}`);
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
			};
		});

		getProjectStatusDataMock.mockResolvedValue(null);

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["status"] },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect(result.message).toContain("Loaded project status context");
		expect((result.data as any)?.status).toBeUndefined();
	});

	it("returns status data when project accessible and status scope requested", async () => {
		mockSupabase.from.mockImplementation((table: string) => {
			if (table !== "projects") throw new Error(`Unexpected table ${table}`);
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
			};
		});

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
		});

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["status"] },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect((result.data as any)?.status?.projectName).toBe("Test Project");
		expect(getProjectStatusDataMock).toHaveBeenCalledWith("project-123", mockSupabase);
	});

	it("returns people evidence when searching for a specific person", async () => {
		const now = new Date().toISOString();
		const projectRow = {
			id: "project-123",
			account_id: "account-abc",
			name: "Test Project",
			description: null,
			created_at: now,
			updated_at: now,
		};
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
		];
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
		];
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
		];

		let recordedOrClause: string | undefined;

		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "projects":
					return {
						select: () => ({
							eq: () => ({
								maybeSingle: () => Promise.resolve({ data: projectRow, error: null }),
							}),
						}),
					};
				case "project_people": {
					const builder: any = {};
					builder.select = () => builder;
					builder.eq = () => builder;
					builder.or = (clause: string) => {
						recordedOrClause = clause;
						return builder;
					};
					builder.order = () => ({
						limit: () => Promise.resolve({ data: peopleRows, error: null }),
					});
					return builder;
				}
				case "interview_people": {
					const builder: any = {};
					builder.select = () => builder;
					builder.eq = () => builder;
					builder.in = () => builder;
					builder.order = () => Promise.resolve({ data: interviewPeopleRows, error: null });
					return builder;
				}
				case "evidence": {
					const builder: any = {};
					builder.select = () => builder;
					builder.eq = () => builder;
					builder.in = () => builder;
					builder.order = () => ({
						limit: () => Promise.resolve({ data: evidenceRows, error: null }),
					});
					return builder;
				}
				case "person_scale": {
					return {
						select: () => ({
							eq: () => ({
								eq: () => Promise.resolve({ data: [], error: null }),
							}),
						}),
					};
				}
				default:
					throw new Error(`Unexpected table ${table}`);
			}
		});

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["people"], peopleSearch: "Jane Doe" },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect(recordedOrClause).toContain("person.name.ilike.*Jane Doe*");
		expect(getProjectStatusDataMock).not.toHaveBeenCalled();
		const person = (result.data as any)?.people?.[0];
		expect(person?.name).toBe("Jane Doe");
		expect(person?.evidence?.[0]?.verbatim).toBe("The onboarding flow takes me 3 tries every time.");
		expect(person?.interviews?.[0]?.title).toBe("Kickoff Interview");
	});

	it("computes icpSummary using all project people, not only the limited people payload", async () => {
		const now = new Date().toISOString();
		const limitedPeopleRows = [
			{
				id: "pp-1",
				person_id: "person-1",
				role: "Buyer",
				interview_count: 8,
				first_seen_at: now,
				last_seen_at: now,
				created_at: now,
				updated_at: now,
				person: {
					id: "person-1",
					name: "Alice",
					segment: null,
					role: "Founder",
					title: "Founder",
					company: "Acme",
					description: null,
					location: null,
					image_url: null,
					contact_info: null,
					people_personas: [],
				},
			},
			{
				id: "pp-2",
				person_id: "person-2",
				role: "Buyer",
				interview_count: 7,
				first_seen_at: now,
				last_seen_at: now,
				created_at: now,
				updated_at: now,
				person: {
					id: "person-2",
					name: "Bob",
					segment: null,
					role: "Operator",
					title: null,
					company: "BetaCo",
					description: null,
					location: null,
					image_url: null,
					contact_info: null,
					people_personas: [],
				},
			},
		];
		const summaryPeopleRows = [
			{ person_id: "person-1", person: { id: "person-1", title: "Founder", company: "Acme" } },
			{ person_id: "person-2", person: { id: "person-2", title: null, company: "BetaCo" } },
			{ person_id: "person-3", person: { id: "person-3", title: "Consultant", company: null } },
			{ person_id: "person-4", person: { id: "person-4", title: null, company: null } },
		];
		const icpScores = [
			{ person_id: "person-1", score: 0.92, band: "HIGH", confidence: 0.9 },
			{ person_id: "person-3", score: 0.44, band: "LOW", confidence: 0.8 },
			{ person_id: "person-x", score: 0.8, band: "HIGH", confidence: 0.6 },
		];

		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "projects":
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
											created_at: now,
											updated_at: now,
										},
										error: null,
									}),
							}),
						}),
					};
				case "project_people":
					return {
						select: (columns: string) => {
							if (columns.includes("interview_count")) {
								const builder: any = {};
								builder.eq = () => builder;
								builder.order = () => ({
									limit: () => Promise.resolve({ data: limitedPeopleRows, error: null }),
								});
								return builder;
							}
							return {
								eq: () => Promise.resolve({ data: summaryPeopleRows, error: null }),
							};
						},
					};
				case "interview_people": {
					const builder: any = {};
					builder.select = () => builder;
					builder.eq = () => builder;
					builder.in = () => builder;
					builder.order = () => Promise.resolve({ data: [], error: null });
					return builder;
				}
				case "person_scale":
					return {
						select: () => ({
							eq: () => ({
								eq: () => Promise.resolve({ data: icpScores, error: null }),
							}),
						}),
					};
				default:
					throw new Error(`Unexpected table ${table}`);
			}
		});

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["people"], peopleLimit: 2 },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect((result.data as any)?.people).toHaveLength(2);
		expect((result.data as any)?.icpSummary).toEqual({
			scored: 2,
			total: 4,
			distribution: {
				HIGH: 1,
				MEDIUM: 0,
				LOW: 1,
				unscored: 2,
			},
			missingDataCount: 3,
		});
	});

	it("defaults to lean scopes (status + sections) when scopes are omitted", async () => {
		const now = new Date().toISOString();

		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "projects":
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
											created_at: now,
											updated_at: now,
										},
										error: null,
									}),
							}),
						}),
					};
				case "project_sections":
					return {
						select: () => ({
							eq: () => ({
								order: () => ({
									order: () =>
										Promise.resolve({
											data: [
												{
													id: "section-1",
													kind: "goal",
													content_md: "Find the top buying signals",
													meta: null,
													position: 1,
													created_at: now,
													updated_at: now,
												},
											],
											error: null,
										}),
								}),
							}),
						}),
					};
				default:
					throw new Error(`Unexpected table ${table}`);
			}
		});

		getProjectStatusDataMock.mockResolvedValue(null);

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123" },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect(result.scopes).toEqual(["status", "sections"]);
		expect((result.data as any)?.sections).toHaveLength(1);
		expect(getProjectStatusDataMock).toHaveBeenCalledWith("project-123", mockSupabase);
	});

	it("includes evidence details by default when evidence scope is requested", async () => {
		const now = new Date().toISOString();

		mockSupabase.from.mockImplementation((table: string) => {
			switch (table) {
				case "projects":
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
											created_at: now,
											updated_at: now,
										},
										error: null,
									}),
							}),
						}),
					};
				case "evidence":
					return {
						select: () => ({
							eq: () => ({
								order: () => ({
									limit: () =>
										Promise.resolve({
											data: [
												{
													id: "ev-1",
													gist: "Pricing confusion blocks purchases",
													verbatim: "I cannot tell which plan fits our team",
													context_summary: null,
													modality: "interview",
													journey_stage: "evaluation",
													topic: "pricing",
													support: "high",
													is_question: false,
													interview_id: "int-1",
													project_id: "project-123",
													created_at: now,
													updated_at: now,
													says: null,
													does: null,
													thinks: null,
													feels: null,
													pains: null,
													gains: null,
													anchors: null,
												},
											],
											error: null,
										}),
								}),
							}),
						}),
					};
				default:
					throw new Error(`Unexpected table ${table}`);
			}
		});

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["evidence"] },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect((result.data as any)?.evidence).toHaveLength(1);
		expect((result.data as any)?.evidence?.[0]?.gist).toContain("Pricing confusion");
	});

	it("skips evidence query when includeEvidence is false", async () => {
		const now = new Date().toISOString();

		mockSupabase.from.mockImplementation((table: string) => {
			if (table === "projects") {
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
										created_at: now,
										updated_at: now,
									},
									error: null,
								}),
						}),
					}),
				};
			}

			if (table === "evidence") {
				throw new Error("Evidence table should not be queried when includeEvidence=false");
			}

			throw new Error(`Unexpected table ${table}`);
		});

		const requestContext = new RequestContext();
		requestContext.set("account_id", "account-123");

		const result = (await fetchProjectStatusContextTool.execute(
			{ projectId: "project-123", scopes: ["evidence"], includeEvidence: false },
			{ requestContext }
		)) as ToolResult;

		expect(result.success).toBe(true);
		expect((result.data as any)?.evidence).toEqual([]);
		expect(result.message).toContain("Evidence details omitted by includeEvidence=false");
	});
});
