import { describe, expect, it } from "vitest";
import type { ResearchLinkQuestion } from "./schemas";
import { formatFlowRangeLabel, formatPathBreakdown, summarizeSurveyFlow } from "./survey-flow";

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

describe("summarizeSurveyFlow", () => {
	it("returns linear path summary for non-branching surveys", () => {
		const summary = summarizeSurveyFlow([
			makeQuestion({ id: "q1", prompt: "A", type: "single_select" }),
			makeQuestion({ id: "q2", prompt: "B", type: "short_text" }),
			makeQuestion({ id: "q3", prompt: "C", type: "long_text" }),
		]);

		expect(summary.hasBranching).toBe(false);
		expect(summary.paths).toHaveLength(1);
		expect(summary.paths[0]?.questionCount).toBe(3);
		expect(formatFlowRangeLabel(summary)).toContain("questions/path");
	});

	it("builds per-target path summaries from early decision point", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({
				id: "q1",
				prompt: "Role",
				type: "single_select",
				options: ["Founder", "Investor"],
				sectionId: "intro",
				sectionTitle: "Intro",
			}),
			makeQuestion({
				id: "q2",
				prompt: "Tenure",
				type: "single_select",
				sectionId: "intro",
				sectionTitle: "Intro",
				branching: {
					rules: [
						{
							id: "path-a",
							action: "skip_to",
							targetSectionId: "path_a",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Founder" }],
							},
						},
						{
							id: "path-b",
							action: "skip_to",
							targetSectionId: "path_b",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Investor" }],
							},
						},
					],
				},
			}),
			makeQuestion({ id: "q3", prompt: "Founder Q", sectionId: "path_a", sectionTitle: "Path A", type: "short_text" }),
			makeQuestion({
				id: "q4",
				prompt: "Founder NPS",
				sectionId: "path_a",
				sectionTitle: "Path A",
				type: "likert",
				branching: {
					rules: [
						{
							id: "end-path-a",
							action: "end_survey",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Founder" }],
							},
						},
					],
				},
			}),
			makeQuestion({
				id: "q5",
				prompt: "Investor Q",
				sectionId: "path_b",
				sectionTitle: "Path B",
				type: "multi_select",
			}),
		];

		const summary = summarizeSurveyFlow(questions);
		expect(summary.hasBranching).toBe(true);
		expect(summary.paths.length).toBeGreaterThanOrEqual(2);
		expect(summary.minQuestions).toBe(3);
		expect(summary.maxQuestions).toBe(4);

		const breakdown = formatPathBreakdown(summary);
		expect(breakdown).toContain("Path A");
		expect(breakdown).toContain("Path B");
	});
});
