/**
 * Tool for parsing natural language guidelines and updating survey branching rules.
 * Uses BAML ParseSurveyGuidelines function to convert NL to structured rules.
 */

import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";

const BranchRuleSchema = z.object({
	id: z.string(),
	conditions: z.object({
		logic: z.enum(["and", "or"]),
		conditions: z.array(
			z.object({
				questionId: z.string(),
				operator: z.enum([
					"equals",
					"not_equals",
					"contains",
					"not_contains",
					"selected",
					"not_selected",
					"answered",
					"not_answered",
				]),
				value: z.union([z.string(), z.array(z.string())]).optional(),
			})
		),
	}),
	action: z.enum(["skip_to", "end_survey"]),
	targetQuestionId: z.string().optional(),
	naturalLanguage: z.string().optional(),
	summary: z.string().optional(),
	guidance: z.string().optional(),
	source: z.enum(["user_ui", "user_voice", "ai_generated"]).optional(),
	confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const updateSurveyGuidelinesTool = createTool({
	id: "update-survey-guidelines",
	description: `Parse natural language guidelines and add them to a survey's branching rules.

Example inputs:
- "If they're a sponsor, focus on budget questions"
- "For enterprise companies, skip to scale-related questions"
- "When they select 'other', end the survey"

The tool will:
1. Parse the natural language into structured branching rules
2. Match conditions to actual questions in the survey
3. Add the rules to the survey's question branching configuration
4. Return a human-friendly summary of what was configured

If the confidence is low, it will suggest clarifications.`,
	inputSchema: z.object({
		surveyId: z.string().describe("ID of the survey to update"),
		guidelines: z.string().describe("Natural language guidelines to parse and add"),
		questionIds: z.array(z.string()).optional().describe("Specific question IDs to apply guidelines to (optional)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		addedRules: z
			.array(
				z.object({
					summary: z.string(),
					triggerQuestion: z.string(),
					action: z.string(),
					confidence: z.string(),
				})
			)
			.optional(),
		clarificationsNeeded: z.array(z.string()).optional(),
		error: z
			.object({
				code: z.string(),
				message: z.string(),
			})
			.optional(),
	}),
	execute: async (input, context?) => {
		try {
			const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			// Fetch the survey with its questions
			const { data: survey, error: surveyError } = await supabase
				.from("research_links")
				.select("id, name, questions")
				.eq("id", input.surveyId)
				.single();

			if (surveyError || !survey) {
				return {
					success: false,
					message: `Survey not found: ${input.surveyId}`,
					error: { code: "SURVEY_NOT_FOUND", message: "Invalid survey ID" },
				};
			}

			const questions =
				(survey.questions as Array<{
					id: string;
					prompt: string;
					type: string;
					options?: string[];
					branching?: {
						rules: Array<z.infer<typeof BranchRuleSchema>>;
					};
				}>) ?? [];

			if (questions.length === 0) {
				return {
					success: false,
					message: "Survey has no questions to apply guidelines to",
					error: { code: "NO_QUESTIONS", message: "Survey has no questions" },
				};
			}

			// Prepare questions for BAML
			const questionInputs = questions.map((q) => ({
				id: q.id,
				prompt: q.prompt,
				type: q.type,
				options: q.options ?? [],
			}));

			// Get existing guideline summaries to avoid conflicts
			const existingGuidelines: string[] = [];
			for (const q of questions) {
				if (q.branching?.rules) {
					for (const rule of q.branching.rules) {
						if (rule.summary) {
							existingGuidelines.push(rule.summary);
						}
					}
				}
			}

			consola.info("update-survey-guidelines: parsing guidelines", {
				surveyId: input.surveyId,
				guidelines: input.guidelines,
				questionCount: questions.length,
				existingRuleCount: existingGuidelines.length,
			});

			// Call BAML to parse the guidelines (dynamic import for Mastra compatibility)
			const bamlClient = await import("../../../baml_client");
			const parseResult = await bamlClient.b.ParseSurveyGuidelines(
				input.guidelines,
				questionInputs,
				existingGuidelines
			);

			consola.info("update-survey-guidelines: parse result", {
				guidelineCount: parseResult.guidelines.length,
				confidence: parseResult.overallConfidence,
				unparseable: parseResult.unparseableSegments,
			});

			// If low confidence or unparseable, return clarifications
			if (parseResult.overallConfidence === "LOW" || parseResult.unparseableSegments.length > 0) {
				return {
					success: false,
					message: `Could not confidently parse the guidelines. ${parseResult.suggestedClarifications.length > 0 ? "Please clarify:" : ""}`,
					clarificationsNeeded: [
						...parseResult.suggestedClarifications,
						...parseResult.unparseableSegments.map((s) => `Could not understand: "${s}"`),
					],
				};
			}

			// Transform parsed guidelines to BranchRule format
			const addedRules: Array<{
				summary: string;
				triggerQuestion: string;
				action: string;
				confidence: string;
			}> = [];

			// Create a map of question ID to index for easy lookup
			const updatedQuestions = [...questions];

			for (const guideline of parseResult.guidelines) {
				// Find the trigger question
				const triggerIndex = updatedQuestions.findIndex((q) => q.id === guideline.condition.questionId);
				if (triggerIndex < 0) {
					consola.warn("update-survey-guidelines: trigger question not found", {
						questionId: guideline.condition.questionId,
					});
					continue;
				}

				const triggerQuestion = updatedQuestions[triggerIndex];

				// Create the branch rule
				const branchRule: z.infer<typeof BranchRuleSchema> = {
					id: guideline.id,
					conditions: {
						logic: "and",
						conditions: [
							{
								questionId: guideline.condition.questionId,
								operator: guideline.condition.operator.toLowerCase() as
									| "equals"
									| "not_equals"
									| "contains"
									| "not_contains"
									| "selected"
									| "not_selected"
									| "answered"
									| "not_answered",
								value: guideline.condition.value ?? undefined,
							},
						],
					},
					action: guideline.action.toLowerCase() as "skip_to" | "end_survey",
					targetQuestionId: guideline.targetQuestionId ?? undefined,
					naturalLanguage: guideline.naturalLanguage,
					summary: guideline.summary,
					guidance: guideline.guidance ?? undefined,
					source: "ai_generated",
					confidence: guideline.confidence.toLowerCase() as "high" | "medium" | "low",
				};

				// Add the rule to the question's branching config
				if (!updatedQuestions[triggerIndex].branching) {
					updatedQuestions[triggerIndex].branching = { rules: [] };
				}
				updatedQuestions[triggerIndex].branching!.rules.push(branchRule);

				addedRules.push({
					summary: guideline.summary,
					triggerQuestion: triggerQuestion.prompt,
					action:
						guideline.action === "SKIP_TO"
							? `Skip to: ${guideline.targetQuestionPrompt ?? "next relevant question"}`
							: "End survey",
					confidence: guideline.confidence,
				});
			}

			if (addedRules.length === 0) {
				return {
					success: false,
					message: "No valid rules could be created from the guidelines",
					clarificationsNeeded: parseResult.suggestedClarifications,
				};
			}

			// Update the survey with the new questions (including branching)
			const { error: updateError } = await supabase
				.from("research_links")
				.update({ questions: updatedQuestions })
				.eq("id", input.surveyId);

			if (updateError) {
				consola.error("update-survey-guidelines: update error", updateError);
				return {
					success: false,
					message: `Failed to save guidelines: ${updateError.message}`,
					error: { code: "DB_ERROR", message: updateError.message },
				};
			}

			const summaryText =
				addedRules.length === 1
					? `Added guideline: "${addedRules[0].summary}"`
					: `Added ${addedRules.length} guidelines`;

			consola.info("update-survey-guidelines: success", {
				surveyId: input.surveyId,
				rulesAdded: addedRules.length,
			});

			return {
				success: true,
				message: summaryText,
				addedRules,
				clarificationsNeeded:
					parseResult.suggestedClarifications.length > 0 ? parseResult.suggestedClarifications : undefined,
			};
		} catch (error) {
			consola.error("update-survey-guidelines: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to update guidelines",
				error: {
					code: "UNEXPECTED_ERROR",
					message: error instanceof Error ? error.message : "Failed to update guidelines",
				},
			};
		}
	},
});
