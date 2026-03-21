import { describe, expect, it } from "vitest";
import { ConditionSchema, evaluateCondition, responsesOnlyContext } from "./branching";
import { buildBranchingContext } from "./branching-context";
import type { ResearchLinkQuestion } from "./schemas";

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
		matrixRows: null,
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

describe("buildBranchingContext", () => {
	it("keeps question-response behavior unchanged", () => {
		const context = responsesOnlyContext({ q1: "founder" });
		expect(
			evaluateCondition({ sourceType: "question", questionId: "q1", operator: "equals", value: "founder" }, context)
		).toBe(true);
	});

	it("evaluates person attribute conditions against known attributes", () => {
		const context = buildBranchingContext({}, [], { seniority_level: "Leadership" });
		expect(
			evaluateCondition(
				{ sourceType: "person_attribute", attributeKey: "seniority_level", operator: "equals", value: "Leadership" },
				context
			)
		).toBe(true);
	});

	it("supports mixed question and person conditions", () => {
		const context = buildBranchingContext({ q1: "yes" }, [], { segment: "Enterprise" });
		expect(
			evaluateCondition(
				{ sourceType: "person_attribute", attributeKey: "segment", operator: "equals", value: "Enterprise" },
				context
			)
		).toBe(true);
		expect(
			evaluateCondition({ sourceType: "question", questionId: "q1", operator: "equals", value: "yes" }, context)
		).toBe(true);
	});

	it("mirrors in-session answers into person attributes using personFieldKey", () => {
		const questions = [makeQuestion({ id: "q1", personFieldKey: "title" })];
		const context = buildBranchingContext({ q1: "VP Sales" }, questions, {});
		expect(context.personAttributes.title).toBe("VP Sales");
	});

	it("mirrors taxonomy-backed answers into person attributes", () => {
		const questions = [makeQuestion({ id: "q1", taxonomyKey: "industry_vertical" })];
		const context = buildBranchingContext({ q1: "Healthcare" }, questions, {});
		expect(context.personAttributes.industry).toBe("Healthcare");
	});

	it("normalizes seniority values from in-session answers", () => {
		const questions = [makeQuestion({ id: "q1", personFieldKey: "seniority_level" })];
		const context = buildBranchingContext({ q1: "VP of Sales" }, questions, {});
		expect(context.personAttributes.seniority_level).toBe("Leadership");
	});

	it("treats missing person attributes as unanswered", () => {
		const context = buildBranchingContext({}, [], {});
		expect(
			evaluateCondition({ sourceType: "person_attribute", attributeKey: "segment", operator: "answered" }, context)
		).toBe(false);
	});

	it("defaults legacy conditions to question source type", () => {
		const parsed = ConditionSchema.parse({
			questionId: "q1",
			operator: "equals",
			value: "yes",
		});
		expect(evaluateCondition(parsed, responsesOnlyContext({ q1: "yes" }))).toBe(true);
	});
});
