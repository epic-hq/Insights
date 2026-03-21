import { describe, expect, it } from "vitest";
import { evaluateCondition, hasResponseValue, responsesOnlyContext } from "./branching";

describe("hasResponseValue", () => {
	it("treats empty multi-select arrays as unanswered", () => {
		expect(hasResponseValue([])).toBe(false);
	});

	it("treats non-empty multi-select arrays as answered", () => {
		expect(hasResponseValue(["Founder"])).toBe(true);
	});

	it("treats trimmed empty strings as unanswered", () => {
		expect(hasResponseValue("   ")).toBe(false);
	});

	it("treats matrix objects with values as answered", () => {
		expect(hasResponseValue({ row_1: "4", row_2: "" })).toBe(true);
	});

	it("treats empty matrix objects as unanswered", () => {
		expect(hasResponseValue({ row_1: "", row_2: null })).toBe(false);
	});
});

describe("evaluateCondition answered/not_answered", () => {
	it("uses shared answer semantics for arrays", () => {
		expect(
			evaluateCondition(
				{ sourceType: "question", questionId: "q1", operator: "answered" },
				responsesOnlyContext({
					q1: [],
				})
			)
		).toBe(false);
		expect(
			evaluateCondition(
				{ sourceType: "question", questionId: "q1", operator: "not_answered" },
				responsesOnlyContext({
					q1: [],
				})
			)
		).toBe(true);
	});

	it("uses shared answer semantics for matrix values", () => {
		expect(
			evaluateCondition(
				{ sourceType: "question", questionId: "q1", operator: "answered" },
				responsesOnlyContext({
					q1: { row_1: "5" },
				})
			)
		).toBe(true);
		expect(
			evaluateCondition(
				{ sourceType: "question", questionId: "q1", operator: "not_answered" },
				responsesOnlyContext({
					q1: { row_1: "" },
				})
			)
		).toBe(true);
	});
});
