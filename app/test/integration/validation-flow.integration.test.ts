import { beforeEach, describe, expect, it, vi } from "vitest";
import { loader as validationLoader } from "~/features/projects/pages/ValidationStatus";
import { runEvidenceAnalysis } from "~/features/research/analysis/runEvidenceAnalysis.server";
import { userContext } from "~/server/user-context";
import { cleanupTestData, seedTestData, TEST_ACCOUNT_ID, TEST_PROJECT_ID, testDb } from "~/test/utils/testDb";

vi.mock("~/../baml_client", () => ({
	b: {
		LinkEvidenceToResearchStructure: vi.fn(),
	},
}));

import { b } from "~/../baml_client";

const mockLinkEvidence = b.LinkEvidenceToResearchStructure as ReturnType<typeof vi.fn>;

const VALIDATION_GATES = ["pain_exists", "awareness", "quantified", "acting"] as const;
type ValidationGateSlug = (typeof VALIDATION_GATES)[number];

describe("Validation Flow Integration", () => {
	beforeEach(async () => {
		mockLinkEvidence.mockReset();
		await cleanupTestData();
		await seedTestData();

		await Promise.all([
			testDb.from("project_question_analysis").delete().eq("project_id", TEST_PROJECT_ID),
			testDb.from("project_research_analysis_runs").delete().eq("project_id", TEST_PROJECT_ID),
			testDb.from("project_answers").delete().eq("project_id", TEST_PROJECT_ID),
			testDb.from("decision_questions").delete().eq("project_id", TEST_PROJECT_ID),
			testDb.from("research_questions").delete().eq("project_id", TEST_PROJECT_ID),
			testDb.from("project_sections").delete().eq("project_id", TEST_PROJECT_ID).eq("kind", "questions"),
			testDb.from("evidence").delete().eq("project_id", TEST_PROJECT_ID),
		]);

		const decisionQuestionId = crypto.randomUUID();
		await testDb.from("decision_questions").insert({
			id: decisionQuestionId,
			project_id: TEST_PROJECT_ID,
			text: "Decide go-to-market focus",
			rationale: "Validate customer pain funnel",
		});

		const researchQuestions = VALIDATION_GATES.map((slug) => ({
			id: crypto.randomUUID(),
			project_id: TEST_PROJECT_ID,
			text: `${slug.replace("_", " ")}`,
			rationale: `Gate ${slug}`,
			decision_question_id: decisionQuestionId,
			slug,
		}));

		await testDb.from("research_questions").insert(researchQuestions.map(({ slug, ...rest }) => rest));

		const validationGateMeta = Object.fromEntries(
			researchQuestions.map((rq) => [rq.slug, { research_question_id: rq.id, research_question_text: rq.text }])
		) as Record<ValidationGateSlug, { research_question_id: string; research_question_text: string }>;

		await testDb.from("project_sections").upsert({
			id: crypto.randomUUID(),
			project_id: TEST_PROJECT_ID,
			kind: "questions",
			position: 2,
			content_md: "# Questions",
			meta: {
				settings: { research_mode: "validation" },
				validation_gate_map: validationGateMeta,
			},
		});

		const evidenceRows = researchQuestions.map((rq, index) => ({
			id: crypto.randomUUID(),
			account_id: TEST_ACCOUNT_ID,
			project_id: TEST_PROJECT_ID,
			interview_id: "interview-1",
			verbatim: `Evidence ${index + 1} for ${rq.slug}`,
			chunk: `Chunk ${index + 1}`,
			gist: `Gist ${index + 1}`,
			support: "supports",
			anchors: [],
		}));

		await testDb.from("evidence").insert(evidenceRows);

		mockLinkEvidence.mockResolvedValue({
			evidence_results: evidenceRows.map((row, index) => ({
				evidence_id: row.id,
				links: [
					{
						question_id: researchQuestions[index].id,
						question_kind: "research",
						relationship: "supports",
						confidence: 0.9,
						answer_summary: `Participant confirmed ${researchQuestions[index].text}`,
						rationale: `Transcript excerpt ${index + 1}`,
						next_steps: `Next action ${index + 1}`,
					},
				],
			})),
			research_question_answers: researchQuestions.map((rq, index) => ({
				research_question_id: rq.id,
				findings: [`Finding ${index + 1} for ${rq.slug}`],
				evidence_ids: [evidenceRows[index].id],
				confidence: 0.82,
				reasoning: `Reasoning ${index + 1}`,
			})),
			decision_question_answers: [],
			global_goal_summary: null,
			recommended_actions: [],
		});
	});

	it("links validation evidence through to the dashboard", async () => {
		await runEvidenceAnalysis({
			supabase: testDb,
			projectId: TEST_PROJECT_ID,
		});

		const loaderResult = await validationLoader({
			context: {
				get(token: unknown) {
					if (token === userContext) {
						return {
							claims: {},
							account_id: TEST_ACCOUNT_ID,
							supabase: testDb,
							headers: new Headers(),
							user_metadata: {},
						};
					}
					return undefined;
				},
			} as any,
			params: { accountId: TEST_ACCOUNT_ID, projectId: TEST_PROJECT_ID } as any,
			request: new Request("http://localhost/validation"),
		});

		expect(loaderResult.participants.length).toBeGreaterThan(0);
		const participant = loaderResult.participants[0];
		expect(participant.validationDetails.painExists?.summary).toContain("Participant confirmed");
		expect(participant.outcome).toBeGreaterThan(1);

		const gateSummary = loaderResult.gateSummaries.find((summary) => summary.slug === "pain_exists");
		expect(gateSummary?.summary).toContain("Finding 1");
		expect(gateSummary?.confidence).toBeCloseTo(0.82, 2);

		expect(loaderResult.progress.completed).toBe(1);
		expect(mockLinkEvidence).toHaveBeenCalled();
	});
});
