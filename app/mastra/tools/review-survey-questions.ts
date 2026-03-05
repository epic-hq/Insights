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
	"hypothetical",
	"not_behavioral",
	"too_complex",
	"low_priority",
] as const;

const severityValues = ["high", "medium", "low"] as const;
const recommendationValues = ["keep", "hide", "rephrase", "delete"] as const;
const coachingProfileValues = ["quick_signal", "balanced", "deep_dive"] as const;

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
					})
				)
				.nullish(),
			suggestedPrompt: z.string().nullish(),
			priority: z.number().nullish(),
			recommendation: z.enum(recommendationValues).nullish(),
		})
	),
	summary: z.string(),
});

function buildReviewPrompt(
	questions: Array<{ id: string; prompt: string; type?: string; options?: string[] | null }>,
	reviewType: string,
	goals: string | null,
	targetCount: number | null,
	coachingProfile: (typeof coachingProfileValues)[number] | null,
	flowContext: string | null
): string {
	const questionList = questions
		.map((q, i) => {
			let line = `${i + 1}. [id=${q.id}] "${q.prompt}" (type: ${q.type ?? "auto"})`;
			if (q.options?.length) line += ` options: [${q.options.join(", ")}]`;
			return line;
		})
		.join("\n");

	const goalContext = goals ? `\nSurvey goals: ${goals}\n` : "";
	const flowContextBlock = flowContext ? `\nCurrent flow architecture: ${flowContext}\n` : "";
	const surveyPlaybook = `Use this survey best-practice playbook:
- Default assumption for public surveys: low-trust, low-incentive respondents. Optimize for completion.
- For quick discovery surveys (or when context is unclear), target 5-7 questions and about 2-3 minutes.
- Prefer simple language (plain, concrete, non-jargon), one idea per question.
- Prioritize past behavior and real experiences over hypotheticals ("what would you do...").
- Keep non-leading tone: do not presuppose pain, success, or preference.
- Balance the set: basic context -> behavior/experience -> pain/impact -> goals/outcomes -> optional solution preferences at the end.
- Ensure each question is relevant to the likely respondent segment; avoid segment-mismatch questions.
- Recommend adding an early screener + branching when different respondent roles need different question paths.
- NPS/likelihood recommendation questions should use 1-10 with clear endpoint labels.
- Limit open text burden; avoid long runs of open-ended questions.
- Mark as not_behavioral when a question only asks opinion/preference without anchoring in experience.
- Mark as hypothetical when it asks future intent/speculation without an anchor in past behavior.
- Mark as too_complex when wording is long, dense, or asks multiple cognitive steps.`;
	const profileGuidance =
		coachingProfile === "quick_signal"
			? `Coaching profile: quick_signal.
- Optimize for speed and completion.
- Target 5-7 questions and ~2-3 minutes.
- Be aggressive about hiding low-signal or high-friction questions.`
			: coachingProfile === "deep_dive"
				? `Coaching profile: deep_dive.
- Optimize for richer depth while staying neutral.
- Target 8-12 questions and ~5-8 minutes.
- Keep useful depth questions unless clearly redundant or biased.`
				: `Coaching profile: balanced.
- Optimize for a practical middle ground.
- Target 6-9 questions and ~3-5 minutes.`;

	switch (reviewType) {
		case "bias_check":
			return `You are a survey methodology expert. Review these survey questions for bias and quality risks.
${goalContext}
${flowContextBlock}
${surveyPlaybook}
${profileGuidance}

Questions:
${questionList}

For each question, identify any issues:
- leading: Question steers toward a particular answer
- loaded: Contains emotionally charged assumptions
- double_barreled: Asks two things at once
- vague: Unclear what is being asked
- jargon: Uses technical terms respondents may not understand
- hypothetical: Future speculation without past-behavior anchor
- not_behavioral: Opinion-only question with no lived-experience anchor
- too_complex: Wording too dense/long to scan quickly

For each issue found, provide a severity (high/medium/low) and explanation.
If a question has issues, suggest a better phrasing in suggestedPrompt.
Set recommendation to "keep" if no issues, "rephrase" if fixable issues exist.
Summary must include an estimated effort target (question count and time).`;

		case "quality_review":
			return `You are a survey design expert. Review these questions for overall quality and respondent completion risk.
${goalContext}
${flowContextBlock}
${surveyPlaybook}
${profileGuidance}

Questions:
${questionList}

For each question, evaluate:
- Clarity and specificity
- Whether it will yield actionable insights
- Potential for bias (leading, loaded, double-barreled, vague, jargon)
- Behavioral quality (past experience vs hypothetical/opinion-only)
- Segment relevance (is this question appropriate for who is being asked?)
- Cognitive burden (simple vs too complex)
- Redundancy with other questions

Set recommendation to "keep", "rephrase", "hide", or "delete".
For "rephrase" recommendations, provide improved wording in suggestedPrompt.
In the summary, include:
- Recommended final question count
- Recommended completion-time target
- Top 2-3 improvements with business impact (better completion, clearer signal, less bias).`;

		case "prioritize":
			return `You are a survey design expert. Prioritize these questions by importance and signal quality.
${goalContext}
${flowContextBlock}
${surveyPlaybook}
${profileGuidance}

Questions:
${questionList}

${targetCount ? `The user wants to keep roughly ${targetCount} questions and hide the rest.` : "Default target is a quick, high-completion survey (usually 5-7 questions)."}

For each question:
- Set priority (1 = highest priority, higher numbers = lower priority)
- Set recommendation: "keep" for the most valuable questions${targetCount ? `, "hide" for the rest` : ", and hide low-signal or redundant items"}
- Favor questions about past behavior, pains, and goals over speculative feature wishlists
- Flag segment-mismatch items for hide/rephrase and mention branch/screener fix in issues when relevant
- If a question is redundant, hypothetical, or opinion-only, explain why in issues
Provide a summary with final recommended count and expected completion time.`;

		case "rephrase":
			return `You are a survey copywriting expert. Rephrase these questions to improve response quality.
${goalContext}
${flowContextBlock}
${surveyPlaybook}
${profileGuidance}

Questions:
${questionList}

For each question:
- Provide an improved version in suggestedPrompt
- Note any issues with the original wording
- Set recommendation to "rephrase" if improved, "keep" if already good
- Keep the same intent but make it simple, neutral, and easy to answer quickly
- Prefer prompts that elicit past behavior ("Tell me about the last time...", "Walk me through...")
- Avoid leading or emotionally loaded language
Provide a brief summary of how rewrites improve completion and signal quality.`;

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
		coachingProfile: z.enum(coachingProfileValues).nullish().describe("How aggressive to be about brevity vs depth"),
		reviewType: z
			.enum(["bias_check", "quality_review", "prioritize", "rephrase"])
			.describe("Type of review to perform"),
		questionIds: z
			.array(z.string())
			.nullish()
			.describe("Specific question IDs to review (null = all visible questions)"),
		targetCount: z.number().nullish().describe("For 'prioritize': target number of questions to keep"),
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
							})
						)
						.nullish(),
					suggestedPrompt: z.string().nullish(),
					priority: z.number().nullish(),
					recommendation: z.enum(recommendationValues).nullish(),
				})
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

			const allQuestions = Array.isArray(survey.questions) ? (survey.questions as Array<Record<string, unknown>>) : [];

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

			const surveyFlowHelpers = await import("../../features/research-links/survey-flow");
			const questionsForFlow = allQuestions.map((q) => ({
				id: (q.id as string) ?? "",
				prompt: (q.prompt as string) ?? "",
				type: (q.type as string) ?? "auto",
				required: Boolean(q.required),
				placeholder: (q.placeholder as string | null) ?? null,
				helperText: (q.helperText as string | null) ?? null,
				options: Array.isArray(q.options) ? (q.options as string[]) : null,
				allowOther: q.allowOther === false ? false : true,
				likertScale: typeof q.likertScale === "number" ? q.likertScale : null,
				likertLabels: (q.likertLabels as { low?: string | null; high?: string | null } | null) ?? null,
				imageOptions: null,
				mediaUrl: (q.mediaUrl as string | null) ?? null,
				videoUrl: (q.videoUrl as string | null) ?? null,
				sectionId: (q.sectionId as string | null) ?? null,
				sectionTitle: (q.sectionTitle as string | null) ?? null,
				taxonomyKey: (q.taxonomyKey as string | null) ?? null,
				personFieldKey: (q.personFieldKey as string | null) ?? null,
				hidden: Boolean(q.hidden),
				branching: (q.branching as Record<string, unknown> | null) ?? null,
			}));
			const flowSummary = surveyFlowHelpers.summarizeSurveyFlow(
				questionsForFlow as Parameters<typeof surveyFlowHelpers.summarizeSurveyFlow>[0]
			);
			const flowContext =
				flowSummary.hasBranching && flowSummary.paths.length > 1
					? `Branching at Q${(flowSummary.decisionQuestionIndex ?? 0) + 1} into ${flowSummary.paths.length} paths. ` +
						flowSummary.paths
							.map((path) => `${path.label}: ${path.questionCount} questions (${path.estimatedMinutesLabel})`)
							.join("; ")
					: `Linear path with ${flowSummary.maxQuestions} questions (${surveyFlowHelpers.formatEstimatedMinutesFromSeconds(flowSummary.maxSeconds)}).`;

			const reviewPrompt = buildReviewPrompt(
				questionsForPrompt,
				input.reviewType,
				toNonEmptyString(input.goals),
				input.targetCount ?? null,
				input.coachingProfile ?? null,
				flowContext
			);

			// Dynamic import to avoid loading AI SDK at module level
			const { generateObject } = await import("ai");
			const { openai } = await import("../../lib/billing/instrumented-openai.server");

			const result = await generateObject({
				model: openai("gpt-4o-mini"),
				schema: reviewResultSchema,
				prompt: reviewPrompt,
			});

			// Check for branch dependency warnings when recommendations include hide/delete
			const branchWarnings: string[] = [];
			const hideOrDeleteIds = new Set(
				result.object.reviews
					.filter((r) => r.recommendation === "hide" || r.recommendation === "delete")
					.map((r) => r.questionId)
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
								`Question "${(q.prompt as string).slice(0, 60)}" branches to ${targetLabel} which is recommended for hide/delete.`
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
