import { describe, expect, it } from "vitest";
import type { ResearchLinkQuestion } from "./schemas";
import { buildSurveySectionGraph } from "./section-graph";

function makeQuestion(overrides: Partial<ResearchLinkQuestion>): ResearchLinkQuestion {
	return {
		id: "q",
		prompt: "",
		required: false,
		type: "auto",
		placeholder: null,
		helperText: null,
		options: null,
		allowOther: true,
		likertScale: null,
		likertLabels: null,
		imageOptions: null,
		mediaUrl: null,
		videoUrl: null,
		sectionId: null,
		sectionTitle: null,
		taxonomyKey: null,
		personFieldKey: null,
		hidden: false,
		branching: null,
		...overrides,
	};
}

describe("buildSurveySectionGraph", () => {
	it("builds section nodes and explicit branching edges", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({ id: "q1", prompt: "Role?", sectionId: "intro", sectionTitle: "Intro" }),
			makeQuestion({
				id: "q2",
				prompt: "Tenure?",
				sectionId: "intro",
				sectionTitle: "Intro",
				branching: {
					rules: [
						{
							id: "rule-a",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Founder" }],
							},
							action: "skip_to",
							targetSectionId: "path_a",
						},
						{
							id: "rule-b",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Investor" }],
							},
							action: "skip_to",
							targetSectionId: "path_b",
						},
					],
				},
			}),
			makeQuestion({ id: "q3", prompt: "Path A Q1", sectionId: "path_a", sectionTitle: "Path A" }),
			makeQuestion({ id: "q4", prompt: "Path B Q1", sectionId: "path_b", sectionTitle: "Path B" }),
		];

		const graph = buildSurveySectionGraph(questions);
		expect(graph.nodes.map((node) => node.id)).toEqual(["intro", "path_a", "path_b"]);
		expect(graph.entrySectionId).toBe("intro");

		const branchingEdges = graph.edges.filter((edge) => edge.action === "skip_to");
		expect(branchingEdges).toHaveLength(2);
		expect(branchingEdges.map((edge) => edge.targetSectionId).sort()).toEqual(["path_a", "path_b"]);
	});

	it("adds linear section transition edges", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({ id: "q1", prompt: "Intro 1", sectionId: "intro", sectionTitle: "Intro" }),
			makeQuestion({ id: "q2", prompt: "Intro 2", sectionId: "intro", sectionTitle: "Intro" }),
			makeQuestion({ id: "q3", prompt: "Close 1", sectionId: "close", sectionTitle: "Close" }),
		];

		const graph = buildSurveySectionGraph(questions);
		const linear = graph.edges.find((edge) => edge.action === "linear");
		expect(linear).toBeTruthy();
		expect(linear?.fromSectionId).toBe("intro");
		expect(linear?.targetSectionId).toBe("close");
		expect(linear?.targetQuestionId).toBe("q3");
	});
});
