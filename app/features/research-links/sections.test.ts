import { describe, expect, it } from "vitest";
import { getNextQuestionId, responsesOnlyContext } from "./branching";
import type { ResearchLinkQuestion } from "./schemas";
import { deriveSurveySections, resolveSectionStartQuestionId } from "./sections";

function makeQuestion(overrides: Partial<ResearchLinkQuestion> = {}): ResearchLinkQuestion {
	return {
		id: overrides.id ?? "q1",
		prompt: overrides.prompt ?? "Question",
		required: false,
		type: "short_text",
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
		hidden: false,
		branching: null,
		...overrides,
	};
}

describe("sections helpers", () => {
	it("uses 'Shared block' title for default section", () => {
		const sections = deriveSurveySections([makeQuestion({ id: "q1", sectionId: null, sectionTitle: null })]);
		expect(sections[0]?.title).toBe("Shared block");
	});

	it("derives ordered section groups from questions", () => {
		const questions = [
			makeQuestion({ id: "q1", sectionId: "intro", sectionTitle: "Intro" }),
			makeQuestion({ id: "q2", sectionId: "intro", sectionTitle: "Intro" }),
			makeQuestion({ id: "q3", sectionId: "path_a", sectionTitle: "Path A" }),
			makeQuestion({ id: "q4", sectionId: "path_b", sectionTitle: "Path B" }),
		];
		const sections = deriveSurveySections(questions);
		expect(sections.map((section) => section.id)).toEqual(["intro", "path_a", "path_b"]);
		expect(sections.map((section) => section.startQuestionId)).toEqual(["q1", "q3", "q4"]);
	});

	it("resolves section start after current question when possible", () => {
		const questions = [
			{ id: "q1", sectionId: "intro" },
			{ id: "q2", sectionId: "intro" },
			{ id: "q3", sectionId: "path_a" },
			{ id: "q4", sectionId: "path_b" },
			{ id: "q5", sectionId: "path_b" },
		];
		const next = resolveSectionStartQuestionId(questions, "path_b", "q2");
		expect(next).toBe("q4");
	});

	it("falls back to first section question if target section appears before current", () => {
		const questions = [
			{ id: "q1", sectionId: "intro" },
			{ id: "q2", sectionId: "intro" },
			{ id: "q3", sectionId: "path_a" },
		];
		const next = resolveSectionStartQuestionId(questions, "intro", "q3");
		expect(next).toBe("q1");
	});
});

describe("branching with targetSectionId", () => {
	it("routes to section start when skip_to uses targetSectionId", () => {
		const q1 = makeQuestion({
			id: "q1",
			sectionId: "intro",
			branching: {
				rules: [
					{
						id: "r1",
						conditions: {
							logic: "and",
							conditions: [{ sourceType: "question", questionId: "q1", operator: "equals", value: "go" }],
						},
						action: "skip_to",
						targetSectionId: "path_b",
					},
				],
			},
		});
		const q2 = makeQuestion({ id: "q2", sectionId: "path_a" });
		const q3 = makeQuestion({ id: "q3", sectionId: "path_b" });
		const q4 = makeQuestion({ id: "q4", sectionId: "path_b" });

		const nextId = getNextQuestionId(q1, [q1, q2, q3, q4], responsesOnlyContext({ q1: "go" }));
		expect(nextId).toBe("q3");
	});
});
