/**
 * Tests for create-survey tool schema validation
 *
 * This tests that the schema accepts the inputs LLMs actually send,
 * including null values for optional fields.
 */

import { describe, expect, it } from "vitest"
import { z } from "zod"

// Recreate the schema from create-survey.ts to test it in isolation
// (Importing the actual tool would trigger Supabase client initialization)

const QuestionInputSchema = z.object({
	prompt: z.string().describe("The question text"),
	type: z.enum(["auto", "short_text", "long_text", "single_select", "multi_select", "likert"]).nullish(),
	required: z.boolean().nullish(),
	options: z.array(z.string()).nullish(),
	likertScale: z.number().min(3).max(10).nullish(),
	likertLabels: z
		.object({
			low: z.string().nullish(),
			high: z.string().nullish(),
		})
		.nullish(),
})

const createSurveyInputSchema = z.object({
	projectId: z.string(),
	surveyId: z.string().nullish(),
	name: z.string(),
	description: z.string().nullish(),
	questions: z.array(QuestionInputSchema).min(1),
	isLive: z.boolean().nullish(),
	allowChat: z.boolean().nullish(),
	defaultResponseMode: z.enum(["form", "chat", "voice"]).nullish(),
})

describe("create-survey schema validation", () => {
	describe("minimal valid input (what LLMs typically send)", () => {
		it("should accept just projectId, name, and one question with prompt only", () => {
			const input = {
				projectId: "proj-123",
				name: "Customer Feedback Survey",
				questions: [{ prompt: "How satisfied are you?" }],
			}

			const result = createSurveyInputSchema.safeParse(input)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.projectId).toBe("proj-123")
				expect(result.data.name).toBe("Customer Feedback Survey")
				expect(result.data.questions).toHaveLength(1)
				expect(result.data.questions[0].prompt).toBe("How satisfied are you?")
				// Optional fields are undefined when omitted (defaults applied in execute())
				expect(result.data.questions[0].type).toBeUndefined()
				expect(result.data.questions[0].required).toBeUndefined()
				expect(result.data.isLive).toBeUndefined()
				expect(result.data.allowChat).toBeUndefined()
				expect(result.data.defaultResponseMode).toBeUndefined()
			}
		})
	})

	describe("null values for optional fields (LLMs send null)", () => {
		it("should accept null for all optional fields", () => {
			// LLMs often send explicit null values - these must pass validation
			// Defaults are applied in execute(), not in the schema
			const input = {
				projectId: "proj-123",
				surveyId: null,
				name: "Test Survey",
				description: null,
				questions: [
					{
						prompt: "Question 1",
						type: null,
						required: null,
						options: null,
						likertScale: null,
						likertLabels: null,
					},
				],
				isLive: null,
				allowChat: null,
				defaultResponseMode: null,
			}

			const result = createSurveyInputSchema.safeParse(input)

			expect(result.success).toBe(true)
			if (result.success) {
				// Explicit nulls pass through validation (defaults applied in execute())
				expect(result.data.surveyId).toBeNull()
				expect(result.data.description).toBeNull()
				expect(result.data.questions[0].type).toBeNull()
				expect(result.data.questions[0].required).toBeNull()
				expect(result.data.questions[0].options).toBeNull()
				expect(result.data.isLive).toBeNull()
				expect(result.data.allowChat).toBeNull()
				expect(result.data.defaultResponseMode).toBeNull()
			}
		})
	})

	describe("explicit values", () => {
		it("should accept all explicit values", () => {
			const input = {
				projectId: "proj-456",
				surveyId: "survey-789",
				name: "Product Feedback",
				description: "Help us improve our product",
				questions: [
					{
						prompt: "How would you rate our product?",
						type: "likert",
						required: true,
						likertScale: 5,
						likertLabels: { low: "Poor", high: "Excellent" },
					},
					{
						prompt: "Which features do you use?",
						type: "multi_select",
						required: false,
						options: ["Feature A", "Feature B", "Feature C"],
					},
				],
				isLive: false,
				allowChat: false,
				defaultResponseMode: "voice",
			}

			const result = createSurveyInputSchema.safeParse(input)

			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.surveyId).toBe("survey-789")
				expect(result.data.description).toBe("Help us improve our product")
				expect(result.data.questions).toHaveLength(2)
				expect(result.data.questions[0].type).toBe("likert")
				expect(result.data.questions[0].required).toBe(true)
				expect(result.data.questions[0].likertScale).toBe(5)
				expect(result.data.questions[0].likertLabels?.low).toBe("Poor")
				expect(result.data.questions[1].type).toBe("multi_select")
				expect(result.data.questions[1].options).toEqual(["Feature A", "Feature B", "Feature C"])
				expect(result.data.isLive).toBe(false)
				expect(result.data.allowChat).toBe(false)
				expect(result.data.defaultResponseMode).toBe("voice")
			}
		})
	})

	describe("validation errors", () => {
		it("should reject missing required projectId", () => {
			const input = {
				name: "Test Survey",
				questions: [{ prompt: "Question?" }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject missing required name", () => {
			const input = {
				projectId: "proj-123",
				questions: [{ prompt: "Question?" }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject empty questions array", () => {
			const input = {
				projectId: "proj-123",
				name: "Empty Survey",
				questions: [],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject question without prompt", () => {
			const input = {
				projectId: "proj-123",
				name: "Bad Survey",
				questions: [{ type: "short_text" }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject invalid question type", () => {
			const input = {
				projectId: "proj-123",
				name: "Test Survey",
				questions: [{ prompt: "Question?", type: "invalid_type" }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject invalid response mode", () => {
			const input = {
				projectId: "proj-123",
				name: "Test Survey",
				questions: [{ prompt: "Question?" }],
				defaultResponseMode: "invalid_mode",
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})

		it("should reject likertScale out of range", () => {
			const input = {
				projectId: "proj-123",
				name: "Test Survey",
				questions: [{ prompt: "Rate this", type: "likert", likertScale: 15 }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(false)
		})
	})

	describe("real-world LLM input patterns", () => {
		it("should accept typical GPT-4 output format", () => {
			// GPT-4 often sends explicit nulls for unused fields
			const input = {
				projectId: "146e8fbe-99ab-4bce-a3ee-d7249c0decda",
				name: "User Research Survey",
				description: "Understanding user needs",
				questions: [
					{
						prompt: "What is your biggest challenge with our product?",
						type: "long_text",
						required: true,
						options: null,
						likertScale: null,
						likertLabels: null,
					},
					{
						prompt: "How likely are you to recommend us?",
						type: "likert",
						required: false,
						options: null,
						likertScale: 10,
						likertLabels: {
							low: "Not likely",
							high: "Very likely",
						},
					},
				],
				isLive: true,
				allowChat: true,
				defaultResponseMode: "form",
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(true)
		})

		it("should accept minimal Claude output format", () => {
			// Claude often omits optional fields entirely
			const input = {
				projectId: "146e8fbe-99ab-4bce-a3ee-d7249c0decda",
				name: "Quick Poll",
				questions: [{ prompt: "Do you like our new feature?" }, { prompt: "Any suggestions for improvement?" }],
			}

			const result = createSurveyInputSchema.safeParse(input)
			expect(result.success).toBe(true)
		})
	})
})
