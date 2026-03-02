/**
 * AI-powered survey question quality analysis tool.
 * Uses generateObject for structured review output.
 * Supports bias checks, quality reviews, prioritization, and rephrasing.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

const issueTypeValues = [
	"leading",
	"loaded",
	"double_barreled",
	"vague",
	"jargon",
	"redundant",
	"low_priority",
] as const;

const severityValues = ["high", "medium", "low"] as const;
const recommendationValues = ["keep", "hide", "rephrase", "delete"] as const;

const reviewResultSchema = z.object({
	reviews: z.array(
		z.object({
			questionId: z.string(),
			originalPrompt: z.string(),
			issues: z
				.array(
					z.object({
						type: z.enum(issueTypeValues),
						explanation: z.string(),
						severity: z.enum(severityValues),
					}),
				)
				.nullish(),
			suggestedPrompt: z.string().nullish(),
			priority: z.number().nullish(),
			recommendation: z.enum(recommendationValues).nullish(),
		}),
	),
	summary: z.string(),
});

function buildReviewPrompt(
	questions: Array<{ id: string; prompt: string; type?: string; options?: string[] | null }>,
	reviewType: string,
	goals: string | null,
	targetCount: number | null,
): string {
	const questionList = questions
		.map((q, i) => {
			let line = `${i + 1}. [id=${q.id}] "${q.prompt}" (type: ${q.type ?? "auto"})`;
			if (q.options?.length) line += ` options: [${q.options.join(", ")}]`;
			return line;
		})
		.join("\n");

	const goalContext = goals ? `\nSurvey goals: ${goals}\n` : "";

	switch (reviewType) {
		case "bias_check":
			return `You are a survey methodology expert. Review these survey questions for bias issues.
${goalContext}
Questions:
${questionList}

For each question, identify any issues:
- leading: Question steers toward a particular answer
- loaded: Contains emotionally charged assumptions
- double_barreled: Asks two things at once
- vague: Unclear what is being asked
- jargon: Uses technical terms respondents may not understand

For each issue found, provide a severity (high/medium/low) and explanation.
If a question has issues, suggest a better phrasing in suggestedPrompt.
Set recommendation to "keep" if no issues, "rephrase" if fixable issues exist.
Provide a brief summary of overall quality.`;

		case "quality_review":
			return `You are a survey design expert. Review these questions for overall quality.
${goalContext}
Questions:
${questionList}

For each question, evaluate:
- Clarity and specificity
- Whether it will yield actionable insights
- Potential for bias (leading, loaded, double-barreled, vague, jargon)
- Redundancy with other questions

Set recommendation to "keep", "rephrase", "hide", or "delete".
For "rephrase" recommendations, provide improved wording in suggestedPrompt.
Provide a brief summary with the most impactful improvements.`;

		case "prioritize":
			return `You are a survey design expert. Prioritize these questions by importance.
${goalContext}
Questions:
${questionList}

${targetCount ? `The user wants to keep roughly ${targetCount} questions and hide the rest.` : "Rank all questions by priority."}

For each question:
- Set priority (1 = highest priority, higher numbers = lower priority)
- Set recommendation: "keep" for the most valuable questions${targetCount ? `, "hide" for the rest` : ""}
- If a question is redundant, explain why in issues
Provide a summary explaining your prioritization rationale.`;

		case "rephrase":
			return `You are a survey copywriting expert. Rephrase these questions to be clearer and more effective.
${goalContext}
Questions:
${questionList}

For each question:
- Provide an improved version in suggestedPrompt
- Note any issues with the original wording
- Set recommendation to "rephrase" if improved, "keep" if already good
- Keep the same intent but make it more conversational and clear
Provide a brief summary of the changes made.`;

		default:
			return `Review these survey questions: ${questionList}`;
	}
}

export const reviewSurveyQuestionsTool = createTool({
	id: "review-survey-questions",
	description: `AI-powered survey question quality analysis. Reviews questions for bias, quality, priority, or rephrasing.
Use this when the user asks to evaluate, review, check for bias, prioritize, or improve their survey questions.
Returns structured reviews with issues, suggestions, and recommendations.`,
	inputSchema: z.object({
		surveyId: z.string().describe("The survey ID to review"),
		goals: z.string().nullish().describe("Survey goals/objectives for context"),
		reviewType: z
			.enum(["bias_check", "quality_review", "prioritize", "rephrase"])
			.describe("Type of review to perform"),
		questionIds: z
			.array(z.string())
			.nullish()
			.describe("Specific question IDs to review (null = all visible questions)"),
		targetCount: z
			.number()
			.nullish()
			.describe("For 'prioritize': target number of questions to keep"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		reviews: z
			.array(
				z.object({
					questionId: z.string(),
					originalPrompt: z.string(),
					issues: z
						.array(
							z.object({
								type: z.enum(issueTypeValues),
								explanation: z.string(),
								severity: z.enum(severityValues),
							}),
						)
						.nullish(),
					suggestedPrompt: z.string().nullish(),
					priority: z.number().nullish(),
					recommendation: z.enum(recommendationValues).nullish(),
				}),
			)
			.nullish(),
		summary: z.string().nullish(),
		branchWarnings: z.array(z.string()).nullish(),
	}),
	execute: async (input, context?) => {
		try {
			const contextSurveyId = context?.requestContext?.get?.("survey_id");
			const surveyId =
				toNonEmptyString(input.surveyId) ??
				(typeof contextSurveyId === "string" ? toNonEmptyString(contextSurveyId) : null);
			if (!surveyId) {
				return { success: false, message: "Missing surveyId." };
			}

			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			const { data: survey, error: fetchError } = await supabase
				.from("research_links")
				.select("id, name, description, questions")
				.eq("id", surveyId)
				.single();

			if (fetchError || !survey) {
				return { success: false, message: `Survey not found: ${surveyId}` };
			}

			const allQuestions = Array.isArray(survey.questions)
				? (survey.questions as Array<Record<string, unknown>>)
				: [];

			// Filter to visible questions, then optionally filter by questionIds
			let questionsToReview = allQuestions.filter((q) => !q.hidden);
			if (input.questionIds?.length) {
				const idSet = new Set(input.questionIds);
				questionsToReview = questionsToReview.filter((q) => idSet.has(q.id as string));
			}

			if (questionsToReview.length === 0) {
				return { success: false, message: "No visible questions found to review." };
			}

			const questionsForPrompt = questionsToReview.map((q) => ({
				id: q.id as string,
				prompt: q.prompt as string,
				type: q.type as string | undefined,
				options: Array.isArray(q.options) ? (q.options as string[]) : null,
			}));

			const reviewPrompt = buildReviewPrompt(
				questionsForPrompt,
				input.reviewType,
				toNonEmptyString(input.goals),
				input.targetCount ?? null,
			);

			// Dynamic import to avoid loading AI SDK at module level
			const { generateObject } = await import("ai");
			const { anthropic } = await import("../../lib/billing/instrumented-anthropic.server");

			const result = await generateObject({
				model: anthropic("claude-haiku-4-5-20251001"),
				schema: reviewResultSchema,
				prompt: reviewPrompt,
			});

			// Check for branch dependency warnings when recommendations include hide/delete
			const branchWarnings: string[] = [];
			const hideOrDeleteIds = new Set(
				result.object.reviews
					.filter((r) => r.recommendation === "hide" || r.recommendation === "delete")
					.map((r) => r.questionId),
			);

			if (hideOrDeleteIds.size > 0) {
				for (const q of allQuestions) {
					if ((q.hidden as boolean) || hideOrDeleteIds.has(q.id as string)) continue;
					const branching = q.branching as { rules?: Array<{ targetQuestionId?: string }> } | null;
					if (!branching?.rules) continue;
					for (const rule of branching.rules) {
						if (rule.targetQuestionId && hideOrDeleteIds.has(rule.targetQuestionId)) {
							const targetQ = allQuestions.find((tq) => tq.id === rule.targetQuestionId);
							const targetLabel = targetQ ? `"${(targetQ.prompt as string).slice(0, 60)}"` : rule.targetQuestionId;
							branchWarnings.push(
								`Question "${(q.prompt as string).slice(0, 60)}" branches to ${targetLabel} which is recommended for hide/delete.`,
							);
						}
					}
				}
			}

			return {
				success: true,
				message: `Reviewed ${questionsToReview.length} question(s) with ${input.reviewType}.`,
				reviews: result.object.reviews,
				summary: result.object.summary,
				branchWarnings: branchWarnings.length > 0 ? branchWarnings : null,
			};
		} catch (error) {
			consola.error("review-survey-questions: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error",
			};
		}
	},
});
