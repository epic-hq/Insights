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
		expect(formatFlowRangeLabel(summary)).toContain("questions");
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

	it("treats defaultNext as a real alternate branch path", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({
				id: "q1",
				prompt: "Role",
				type: "single_select",
				options: ["Founder", "Service provider"],
				sectionId: "intro",
				sectionTitle: "Intro",
				branching: {
					rules: [
						{
							id: "service-provider-path",
							action: "skip_to",
							targetSectionId: "service_path",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Service provider" }],
							},
						},
					],
					defaultNext: "q2",
				},
			}),
			makeQuestion({
				id: "q2",
				prompt: "Founder need",
				type: "short_text",
				sectionId: "founder_path",
				sectionTitle: "Founder path",
				branching: {
					rules: [
						{
							id: "founder-rejoin",
							action: "skip_to",
							targetSectionId: "shared_close",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "not_equals", value: "Service provider" }],
							},
						},
					],
				},
			}),
			makeQuestion({
				id: "q3",
				prompt: "Service provider need",
				type: "short_text",
				sectionId: "service_path",
				sectionTitle: "Service path",
				branching: {
					rules: [
						{
							id: "service-rejoin",
							action: "skip_to",
							targetSectionId: "shared_close",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Service provider" }],
							},
						},
					],
				},
			}),
			makeQuestion({
				id: "q4",
				prompt: "Shared close",
				type: "long_text",
				sectionId: "shared_close",
				sectionTitle: "Shared close",
			}),
		];

		const summary = summarizeSurveyFlow(questions);
		expect(summary.hasBranching).toBe(true);
		expect(summary.paths).toHaveLength(2);
		expect(summary.minQuestions).toBe(3);
		expect(summary.maxQuestions).toBe(3);
	});

	it("treats answered-based rejoin rules as part of the path estimate", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({
				id: "q1",
				prompt: "Role",
				type: "single_select",
				options: ["Founder", "Service provider"],
				branching: {
					rules: [
						{
							id: "route-service",
							action: "skip_to",
							targetSectionId: "service_path",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Service provider" }],
							},
						},
					],
					defaultNext: "q2",
				},
			}),
			makeQuestion({
				id: "q2",
				prompt: "Founder 1",
				type: "short_text",
				sectionId: "founder_path",
				sectionTitle: "Founder path",
			}),
			makeQuestion({
				id: "q3",
				prompt: "Founder 2",
				type: "short_text",
				sectionId: "founder_path",
				sectionTitle: "Founder path",
				branching: {
					rules: [
						{
							id: "founder-close",
							action: "skip_to",
							targetSectionId: "shared_close",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q3", operator: "answered" }],
							},
						},
					],
				},
			}),
			makeQuestion({
				id: "q4",
				prompt: "Service 1",
				type: "short_text",
				sectionId: "service_path",
				sectionTitle: "Service path",
			}),
			makeQuestion({
				id: "q5",
				prompt: "Service 2",
				type: "short_text",
				sectionId: "service_path",
				sectionTitle: "Service path",
			}),
			makeQuestion({
				id: "q6",
				prompt: "Shared close",
				type: "long_text",
				sectionId: "shared_close",
				sectionTitle: "Shared close",
			}),
		];

		const summary = summarizeSurveyFlow(questions);
		expect(summary.hasBranching).toBe(true);
		expect(summary.paths).toHaveLength(2);
		expect(summary.minQuestions).toBe(4);
		expect(summary.maxQuestions).toBe(4);
	});

	it("captures downstream decision points when computing shortest and longest paths", () => {
		const questions: ResearchLinkQuestion[] = [
			makeQuestion({
				id: "q1",
				prompt: "Role",
				type: "single_select",
				options: ["Founder", "Service provider", "Investor"],
				sectionId: "shared",
				sectionTitle: "Shared",
			}),
			makeQuestion({
				id: "q2",
				prompt: "Organization",
				type: "short_text",
				sectionId: "shared",
				sectionTitle: "Shared",
				branching: {
					rules: [
						{
							id: "route-service",
							action: "skip_to",
							targetSectionId: "service_path",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Service provider" }],
							},
						},
						{
							id: "route-investor",
							action: "skip_to",
							targetSectionId: "investor_path",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q1", operator: "equals", value: "Investor" }],
							},
						},
					],
					defaultNext: "q3",
				},
			}),
			makeQuestion({
				id: "q3",
				prompt: "Founder needs",
				type: "multi_select",
				sectionId: "founder_path",
				sectionTitle: "Founder path",
			}),
			makeQuestion({
				id: "q4",
				prompt: "Need fundraising help",
				type: "single_select",
				options: ["Yes", "No"],
				sectionId: "founder_path",
				sectionTitle: "Founder path",
				branching: {
					rules: [
						{
							id: "route-funding",
							action: "skip_to",
							targetSectionId: "funding_path",
							conditions: {
								logic: "or",
								conditions: [{ questionId: "q4", operator: "equals", value: "Yes" }],
							},
						},
					],
					defaultNext: "q8",
				},
			}),
			makeQuestion({
				id: "q5",
				prompt: "Funding matrix",
				type: "matrix",
				sectionId: "funding_path",
				sectionTitle: "Funding path",
				matrixRows: [
					{ id: "row_1", label: "Investor access" },
					{ id: "row_2", label: "Pitch feedback" },
				],
				branching: {
					rules: [],
					defaultNext: "q8",
				},
			}),
			makeQuestion({
				id: "q6",
				prompt: "Service question",
				type: "image_select",
				sectionId: "service_path",
				sectionTitle: "Service path",
				imageOptions: [{ label: "Directory", imageUrl: "https://example.com/directory.png" }],
				branching: {
					rules: [],
					defaultNext: "q8",
				},
			}),
			makeQuestion({
				id: "q7",
				prompt: "Investor question",
				type: "likert",
				sectionId: "investor_path",
				sectionTitle: "Investor path",
				branching: {
					rules: [],
					defaultNext: "q8",
				},
			}),
			makeQuestion({
				id: "q8",
				prompt: "Closing question",
				type: "long_text",
				sectionId: "shared_close",
				sectionTitle: "Shared close",
			}),
		];

		const summary = summarizeSurveyFlow(questions);

		expect(summary.minQuestions).toBe(4);
		expect(summary.maxQuestions).toBe(6);
		expect(formatFlowRangeLabel(summary)).toContain("4-6 questions");
	});
});
