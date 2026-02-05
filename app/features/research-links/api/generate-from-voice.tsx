/**
 * API endpoint for generating a complete survey from voice/text input
 *
 * Takes natural language describing what the user wants to learn and generates:
 * - Survey name and description
 * - Relevant questions with types
 * - Branching guidelines (parsed from natural language)
 */

import { anthropic } from "@ai-sdk/anthropic"
import { generateObject } from "ai"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { createEmptyQuestion } from "../schemas"

const RequestSchema = z.object({
	transcript: z.string().min(1),
	projectContext: z.string().optional().default(""),
})

const QuestionTypeSchema = z.enum(["short_text", "long_text", "single_select", "multi_select", "rating", "email"])

const GeneratedQuestionSchema = z.object({
	prompt: z.string(),
	type: QuestionTypeSchema,
	options: z.array(z.string()).optional(),
	required: z.boolean().default(true),
})

const GuidelineSchema = z.object({
	summary: z.string().describe("Human-readable summary like 'For sponsors, focus on budget questions'"),
	triggerQuestionIndex: z.number().describe("Which question triggers this rule (0-indexed)"),
	triggerValue: z.string().describe("What value/response triggers this rule"),
	action: z.enum(["skip_to", "end_survey"]),
	targetQuestionIndex: z.number().optional().describe("For skip_to: which question to jump to"),
	guidance: z.string().optional().describe("AI hint for chat mode, e.g., 'Probe on ROI expectations'"),
	confidence: z.enum(["high", "medium", "low"]).describe("How confident you are in this interpretation"),
	clarificationNeeded: z.string().optional().describe("If medium/low confidence, what clarification would help"),
})

const SurveyGenerationSchema = z.object({
	name: z.string().describe("Concise survey title, 3-6 words"),
	description: z.string().describe("Brief description of the survey's purpose"),
	questions: z.array(GeneratedQuestionSchema).min(3).max(10),
	guidelines: z.array(GuidelineSchema).optional().default([]),
	insights: z.string().optional().describe("Any insights about the user's research goals"),
})

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		const rawPayload = {
			transcript: formData.get("transcript") ?? "",
			projectContext: formData.get("projectContext") ?? "",
		}

		const parsed = RequestSchema.safeParse(rawPayload)
		if (!parsed.success) {
			return Response.json({ error: "Invalid request" }, { status: 400 })
		}

		const { transcript, projectContext } = parsed.data

		const result = await generateObject({
			model: anthropic("claude-sonnet-4-20250514"),
			schema: SurveyGenerationSchema,
			prompt: `You are an expert research assistant helping create a survey. The user has described what they want to learn in natural language. Generate a complete, well-structured survey.

USER'S REQUEST:
"${transcript}"

${projectContext ? `PROJECT CONTEXT:\n${projectContext}\n` : ""}

TASK:
1. Create a clear, concise survey name (3-6 words)
2. Write a brief description explaining the survey's purpose
3. Generate 4-7 relevant questions that will help the user learn what they need
4. If appropriate, add branching guidelines for personalized survey paths

QUESTION DESIGN PRINCIPLES:
- Start with a qualifying/segmentation question if the user mentioned different groups
- Use the right question type:
  - short_text: Names, titles, simple facts
  - long_text: Opinions, experiences, detailed feedback
  - single_select: Mutually exclusive choices (provide options array)
  - multi_select: Multiple selections allowed (provide options array)
  - rating: Satisfaction, likelihood, preference scales
  - email: Contact collection
- Make questions conversational and easy to answer
- Each question should provide unique insight
- Order questions logically - easier questions first, sensitive/complex later

BRANCHING GUIDELINES:
If the user mentioned wanting different questions for different groups (e.g., "for sponsors focus on budget", "if they're enterprise, ask about scale"), create guidelines:
- triggerQuestionIndex: which question triggers the rule
- triggerValue: what response triggers it (exact match for select, keyword for text)
- action: "skip_to" to jump to a question, "end_survey" to finish early
- targetQuestionIndex: where to skip to (for skip_to)
- guidance: hints for AI chat mode (e.g., "Probe on approval process")
- summary: human-readable description using "For...", "When...", "If respondents..."
- confidence: "high" if you're sure, "medium" if reasonable interpretation, "low" if unclear
- clarificationNeeded: if medium/low, what specific question would help clarify

CONFIDENCE GUIDANCE:
- HIGH: User explicitly mentioned the condition and action
- MEDIUM: Reasonable interpretation but some ambiguity (e.g., "focus on budget" - which questions are "budget" questions?)
- LOW: Multiple interpretations possible, needs user input

Generate a survey that will help the user gather the insights they described.`,
		})

		// Transform generated questions to match ResearchLinkQuestion format
		const questions = result.object.questions.map((q, index) => ({
			...createEmptyQuestion(),
			prompt: q.prompt,
			type: q.type,
			options: q.options ?? [],
			required: q.required,
		}))

		// Transform guidelines to match BranchRule format
		const guidelines = (result.object.guidelines ?? []).map((g, index) => {
			const triggerQuestion = questions[g.triggerQuestionIndex]
			const targetQuestion = g.targetQuestionIndex !== undefined ? questions[g.targetQuestionIndex] : null

			return {
				id: `gl-${Date.now()}-${index}`,
				summary: g.summary,
				triggerQuestionId: triggerQuestion?.id,
				triggerQuestionIndex: g.triggerQuestionIndex,
				triggerValue: g.triggerValue,
				action: g.action,
				targetQuestionId: targetQuestion?.id,
				targetQuestionIndex: g.targetQuestionIndex,
				guidance: g.guidance,
				confidence: g.confidence ?? ("high" as const),
				source: "ai_generated" as const,
				clarificationNeeded: g.clarificationNeeded,
			}
		})

		// Collect clarifications from guidelines that need them
		const clarifications = guidelines
			.filter((g) => g.confidence !== "high" && g.clarificationNeeded)
			.map((g) => ({
				guidelineId: g.id,
				summary: g.summary,
				confidence: g.confidence,
				question: g.clarificationNeeded!,
			}))

		// Determine if any clarifications are needed
		const needsClarification = clarifications.length > 0

		return Response.json({
			name: result.object.name,
			description: result.object.description,
			questions,
			guidelines,
			insights: result.object.insights,
			needsClarification,
			clarifications,
		})
	} catch (error) {
		console.error("Failed to generate survey from voice:", error)
		return Response.json({ error: "Failed to generate survey. Please try again." }, { status: 500 })
	}
}
