import { describe, expect, it } from "vitest";
import type { UpsightMessage } from "~/mastra/message-types";
import { extractSurveyQuestionUpdateDetails } from "./survey-question-sync";

function makeAssistantMessage(parts: unknown[]): UpsightMessage {
	return {
		id: "m1",
		role: "assistant",
		parts: parts as UpsightMessage["parts"],
	};
}

describe("extractSurveyQuestionUpdateDetails", () => {
	it("extracts successful update-survey-questions output from AI SDK v5 tool part", () => {
		const message = makeAssistantMessage([
			{
				type: "tool-update-survey-questions",
				state: "output-available",
				input: { surveyId: "survey-123", action: "reorder" },
				output: { success: true, updatedCount: 8 },
			},
		]);

		const result = extractSurveyQuestionUpdateDetails(message);
		expect(result).toEqual([{ surveyId: "survey-123", action: "reorder", updatedCount: 8 }]);
	});

	it("ignores failed tool outputs", () => {
		const message = makeAssistantMessage([
			{
				type: "tool-update-survey-questions",
				state: "output-available",
				input: { surveyId: "survey-123", action: "update" },
				output: { success: false, updatedCount: 0 },
			},
		]);

		const result = extractSurveyQuestionUpdateDetails(message);
		expect(result).toEqual([]);
	});

	it("supports underscored toolName via toolInvocation payload", () => {
		const message = makeAssistantMessage([
			{
				type: "tool-invocation",
				toolInvocation: {
					toolName: "update_survey_questions",
					state: "output-available",
					args: { surveyId: "survey-456", action: "delete" },
					output: { success: true, updatedCount: 2 },
				},
			},
		]);

		const result = extractSurveyQuestionUpdateDetails(message);
		expect(result).toEqual([{ surveyId: "survey-456", action: "delete", updatedCount: 2 }]);
	});
});
