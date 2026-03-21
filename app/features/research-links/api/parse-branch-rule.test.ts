// @vitest-environment node

import { generateObject } from "ai";
import type { ActionFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { action } from "./parse-branch-rule";

vi.mock("ai", () => ({
	generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/anthropic", () => ({
	anthropic: vi.fn((model: string) => `mock:${model}`),
}));

const mockedGenerateObject = vi.mocked(generateObject);

function buildArgs(body: unknown): ActionFunctionArgs {
	return {
		request: new Request("http://localhost/api/parse-branch-rule", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
		params: {},
		context: {},
	} as unknown as ActionFunctionArgs;
}

describe("parse-branch-rule action", () => {
	beforeEach(() => {
		mockedGenerateObject.mockReset();
	});

	it("parses person attribute rules into structured conditions and section targets", async () => {
		mockedGenerateObject.mockResolvedValueOnce({
			object: {
				sourceType: "person_attribute",
				attributeKey: "membership_status",
				triggerValue: "active",
				operator: "equals",
				conditionLogic: "and",
				action: "skip_to",
				targetSectionId: "shared_closing",
				summary: "If active members respond, go to shared closing",
				confidence: "high",
			},
		} as never);

		const result = (await action(
			buildArgs({
				input: "If membership status is active, skip to shared closing",
				questionId: "q1",
				questionPrompt: "Membership question",
				questionType: "single_select",
				questionOptions: ["active", "inactive"],
				laterQuestions: [{ id: "q2", prompt: "Next question", index: 0 }],
				laterSections: [{ id: "shared_closing", title: "Shared closing", startQuestionId: "q2" }],
			})
		)) as { rule?: { conditions: { conditions: Array<Record<string, unknown>> }; targetSectionId?: string } };

		expect(result.rule?.targetSectionId).toBe("shared_closing");
		expect(result.rule?.conditions.conditions[0]).toMatchObject({
			sourceType: "person_attribute",
			attributeKey: "membership_status",
			operator: "equals",
			value: "active",
		});
	});

	it("falls back to question conditions for answer-based rules", async () => {
		mockedGenerateObject.mockResolvedValueOnce({
			object: {
				sourceType: "question",
				triggerValue: "Founder",
				operator: "equals",
				conditionLogic: "and",
				action: "skip_to",
				targetQuestionIndex: 0,
				summary: "If founders respond, go to founder questions",
				confidence: "high",
			},
		} as never);

		const result = (await action(
			buildArgs({
				input: "If founder, skip to founder questions",
				questionId: "q1",
				questionPrompt: "What is your role?",
				questionType: "single_select",
				questionOptions: ["Founder", "Investor"],
				laterQuestions: [{ id: "q2", prompt: "Founder stage", index: 0 }],
				laterSections: [],
			})
		)) as { rule?: { targetQuestionId?: string; conditions: { conditions: Array<Record<string, unknown>> } } };

		expect(result.rule?.targetQuestionId).toBe("q2");
		expect(result.rule?.conditions.conditions[0]).toMatchObject({
			sourceType: "question",
			questionId: "q1",
			operator: "equals",
			value: "Founder",
		});
	});
});
