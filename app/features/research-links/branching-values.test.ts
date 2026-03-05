import { describe, expect, it } from "vitest";
import { evaluateCondition, hasResponseValue } from "./branching";

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
});

describe("evaluateCondition answered/not_answered", () => {
	it("uses shared answer semantics for arrays", () => {
		expect(
			evaluateCondition(
				{ questionId: "q1", operator: "answered" },
				{
					q1: [],
				}
			)
		).toBe(false);
		expect(
			evaluateCondition(
				{ questionId: "q1", operator: "not_answered" },
				{
					q1: [],
				}
			)
		).toBe(true);
	});
});
