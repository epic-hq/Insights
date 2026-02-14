/**
 * Tests for create-survey tool schema validation
 *
 * This tests that the schema accepts loose LLM payloads and only enforces
 * core constraints (name + at least one question).
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

const createSurveyInputSchema = z
	.object({
		projectId: z.string().nullish().default(""),
		name: z.string(),
		description: z.string().nullish().default(null),
		questions: z.array(z.record(z.unknown())).min(1),
		isLive: z.boolean().nullish(),
	})
	.passthrough();

describe("create-survey schema validation", () => {
	it("accepts minimal LLM payloads", () => {
		const input = {
			projectId: "proj-123",
			name: "Customer Feedback Survey",
			questions: [{ prompt: "How satisfied are you?" }],
		};

		const result = createSurveyInputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it("accepts mixed question shapes without options/likert fields", () => {
		const input = {
			projectId: "proj-123",
			name: "Pricing Feedback Survey",
			questions: [
				{ prompt: "Q1", type: "single_select" },
				{ prompt: "Q2", type: "likert" },
				{ prompt: "Q3", type: "multi_select" },
				{ prompt: "Q4" },
			],
		};

		const result = createSurveyInputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it("accepts null and extra fields from model output", () => {
		const input = {
			name: "Loose Survey",
			description: null,
			questions: [
				{
					prompt: "Question 1",
					type: null,
					options: null,
					likertScale: null,
					likertLabels: null,
					extraMetadata: { source: "llm" },
				},
			],
			isLive: null,
			surveyId: null,
		};

		const result = createSurveyInputSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it("rejects missing survey name", () => {
		const result = createSurveyInputSchema.safeParse({
			projectId: "proj-123",
			questions: [{ prompt: "Question?" }],
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty questions array", () => {
		const result = createSurveyInputSchema.safeParse({
			projectId: "proj-123",
			name: "Empty Survey",
			questions: [],
		});
		expect(result.success).toBe(false);
	});
});
