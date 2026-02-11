/**
 * Tool for searching and aggregating survey (Ask link) responses
 * Enables chat agents to access likert ratings, select answers, and text responses
 */
import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase/client.server";
import type { Database } from "../../types";
import { resolveProjectContext } from "./context-utils";

const QuestionTypeEnum = z.enum([
	"auto",
	"short_text",
	"long_text",
	"single_select",
	"multi_select",
	"likert",
	"image_select",
]);

type QuestionType = z.infer<typeof QuestionTypeEnum>;

interface QuestionDefinition {
	id: string;
	prompt: string;
	type: QuestionType;
	options?: string[] | null;
	likertScale?: number | null;
	likertLabels?: { low?: string; high?: string } | null;
}

interface QuestionStats {
	average?: number;
	distribution?: Record<string, number>;
	percentages?: Record<string, number>;
}

interface TextResponse {
	answer: string;
	responseId: string;
	responseUrl: string;
	personName: string | null;
}

interface QuestionSummary {
	questionId: string;
	prompt: string;
	type: QuestionType;
	responseCount: number;
	stats?: QuestionStats;
	textResponses?: TextResponse[];
}

/** Individual response with link to view it */
interface ResponseSummary {
	responseId: string;
	responseUrl: string;
	personName: string | null;
	email: string | null;
	completed: boolean;
}

interface SurveySummary {
	surveyId: string;
	surveyName: string;
	responsesUrl: string;
	responseCount: number;
	completedCount: number;
	/** Individual responses with direct URLs - USE THESE when citing specific answers */
	responses: ResponseSummary[];
	questions: QuestionSummary[];
}

export const searchSurveyResponsesTool = createTool({
	id: "search-survey-responses",
	description: `Search and aggregate survey (Ask link) responses. ALWAYS use this tool FIRST when user asks about surveys, Ask links, survey responses, ratings, NPS scores, what people said in surveys, or any structured feedback.

RETURNED DATA STRUCTURE:
- surveys[].responses[] = individual submissions with { responseId, responseUrl, personName, email }
- surveys[].questions[].textResponses[] = text answers with { answer, responseUrl, personName }

MANDATORY LINKING RULES:
1. When quoting a text answer, use the responseUrl from that textResponse: [personName](responseUrl): "their quote"
2. When mentioning someone's overall submission, use responseUrl from responses array
3. EVERY quote or citation MUST include a markdown link to responseUrl
4. Format: [Name](responseUrl) or [View response](responseUrl)
5. NEVER fabricate URLs - only use responseUrl values from tool output`,
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID to search within (defaults to runtime context)"),
		query: z.string().nullish().describe("Natural language search query to filter surveys by name or question text"),
		researchLinkId: z.string().nullish().describe("Filter to a specific survey by ID"),
		personId: z.string().nullish().describe("Filter to responses from a specific person"),
		questionTypes: z
			.array(QuestionTypeEnum)
			.nullish()
			.describe("Filter to specific question types: likert, single_select, multi_select, short_text, long_text"),
		completedOnly: z
			.boolean()
			.nullish()
			.describe(
				"Only include completed responses. Set to true to exclude partial responses. Default is false (includes all)."
			),
		limit: z.number().int().min(1).max(100).nullish().describe("Maximum number of responses to analyze (default: 20)"),
		includeTextResponses: z
			.boolean()
			.nullish()
			.describe("Include individual text responses for open-ended questions (default: true)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		surveys: z.array(
			z.object({
				surveyId: z.string(),
				surveyName: z.string(),
				responsesUrl: z.string().describe("URL to view all responses for this survey"),
				responseCount: z.number(),
				completedCount: z.number(),
				responses: z
					.array(
						z.object({
							responseId: z.string(),
							responseUrl: z
								.string()
								.describe("Direct URL to this response - USE THIS when citing answers from this person"),
							personName: z.string().nullable(),
							email: z.string().nullable(),
							completed: z.boolean(),
						})
					)
					.describe("Individual responses with direct URLs - ALWAYS use responseUrl when citing specific answers"),
				questions: z.array(
					z.object({
						questionId: z.string(),
						prompt: z.string(),
						type: QuestionTypeEnum,
						responseCount: z.number(),
						stats: z
							.object({
								average: z.number().optional(),
								distribution: z.record(z.number()).optional(),
								percentages: z.record(z.number()).optional(),
							})
							.optional(),
						textResponses: z
							.array(
								z.object({
									answer: z.string(),
									responseId: z.string(),
									responseUrl: z.string().describe("URL to view this specific response"),
									personName: z.string().nullable(),
								})
							)
							.optional(),
					})
				),
			})
		),
		totalResponses: z.number(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;

		// Use resolveProjectContext to get proper accountId from project record
		// This ensures URLs are always constructed with the correct account path
		let accountId: string;
		let projectId: string;
		let projectPath: string;

		try {
			const resolved = await resolveProjectContext(context, "search-survey-responses");
			accountId = resolved.accountId;
			// Allow input.projectId to override if provided
			projectId = input.projectId ?? resolved.projectId;
			projectPath = `/a/${accountId}/${projectId}`;
		} catch (error) {
			// If context resolution fails, try to use input.projectId as fallback
			const runtimeProjectId = context?.requestContext?.get?.("project_id");
			projectId = input.projectId ?? ((runtimeProjectId ? String(runtimeProjectId).trim() : null) as string);

			if (!projectId) {
				consola.error("search-survey-responses: No project context available");
				return {
					success: false,
					message: "Missing project context. Pass projectId parameter or ensure x-projectid header is set.",
					surveys: [],
					totalResponses: 0,
				};
			}

			// Fallback: accountId not available, URLs will be incomplete
			accountId = "";
			projectPath = "";
			consola.warn("search-survey-responses: accountId not resolved, URLs may be incomplete");
		}

		consola.info("search-survey-responses: execute start", {
			inputProjectId: input.projectId,
			resolvedProjectId: projectId,
			resolvedAccountId: accountId,
			projectPath,
			query: input.query,
			researchLinkId: input.researchLinkId,
			personId: input.personId,
			questionTypes: input.questionTypes,
			completedOnly: input.completedOnly,
			limit: input.limit,
		});

		try {
			// 1. Fetch research links for this project
			let linksQuery = supabase.from("research_links").select("id, name, questions").eq("project_id", projectId);

			if (input.researchLinkId) {
				linksQuery = linksQuery.eq("id", input.researchLinkId);
			}

			if (input.query) {
				// Search by survey name
				linksQuery = linksQuery.ilike("name", `%${input.query}%`);
			}

			const { data: links, error: linksError } = await linksQuery;

			if (linksError) {
				consola.error("search-survey-responses: links query error", linksError);
				return {
					success: false,
					message: `Database error: ${linksError.message}`,
					surveys: [],
					totalResponses: 0,
				};
			}

			if (!links || links.length === 0) {
				return {
					success: true,
					message: input.query
						? `No surveys found matching "${input.query}" in this project.`
						: "No surveys found in this project.",
					surveys: [],
					totalResponses: 0,
				};
			}

			// 2. Fetch responses for these links
			const linkIds = links.map((l) => l.id);
			let responsesQuery = supabase
				.from("research_link_responses")
				.select("id, research_link_id, email, responses, completed, person_id, person:people(id, name)")
				.in("research_link_id", linkIds)
				.order("created_at", { ascending: false })
				.limit(input.limit ?? 20);

			// Default to including all responses (completedOnly: false) to show partial responses too
			// Only filter for completed if explicitly set to true
			if (input.completedOnly === true) {
				responsesQuery = responsesQuery.eq("completed", true);
			}

			if (input.personId) {
				responsesQuery = responsesQuery.eq("person_id", input.personId);
			}

			const { data: responses, error: responsesError } = await responsesQuery;

			if (responsesError) {
				consola.error("search-survey-responses: responses query error", responsesError);
				return {
					success: false,
					message: `Database error: ${responsesError.message}`,
					surveys: [],
					totalResponses: 0,
				};
			}

			// 3. Process and aggregate responses by survey
			const surveys: SurveySummary[] = [];
			let totalResponses = 0;

			for (const link of links) {
				const linkResponses = responses?.filter((r) => r.research_link_id === link.id) ?? [];
				if (linkResponses.length === 0) continue;

				totalResponses += linkResponses.length;
				const completedCount = linkResponses.filter((r) => r.completed).length;

				// Parse questions
				const questions = (link.questions as unknown as QuestionDefinition[]) ?? [];
				const filteredQuestions = input.questionTypes
					? questions.filter((q) => input.questionTypes?.includes(q.type))
					: questions;

				const questionSummaries: QuestionSummary[] = [];

				for (const question of filteredQuestions) {
					const summary = aggregateQuestionResponses(
						question,
						linkResponses as unknown as ResponseRow[],
						input.includeTextResponses ?? true,
						projectPath,
						link.id
					);
					questionSummaries.push(summary);
				}

				// Build individual response summaries with direct URLs
				const responseSummaries: ResponseSummary[] = linkResponses.map((r) => {
					const response = r as unknown as ResponseRow;
					return {
						responseId: response.id,
						responseUrl: projectPath
							? `${projectPath}/ask/${link.id}/responses/${response.id}`
							: `/ask/${link.id}/responses/${response.id}`,
						personName: response.person?.name ?? null,
						email: response.email ?? null,
						completed: response.completed,
					};
				});

				surveys.push({
					surveyId: link.id,
					surveyName: link.name,
					responsesUrl: projectPath ? `${projectPath}/ask/${link.id}/responses` : `/ask/${link.id}/responses`,
					responseCount: linkResponses.length,
					completedCount,
					responses: responseSummaries,
					questions: questionSummaries,
				});
			}

			// Build message
			const surveyCount = surveys.length;
			const message =
				surveyCount === 0
					? "No responses found for the matching surveys."
					: surveyCount === 1
						? `Found ${totalResponses} response${totalResponses !== 1 ? "s" : ""} for "${surveys[0].surveyName}".`
						: `Found ${totalResponses} responses across ${surveyCount} surveys.`;

			consola.info("search-survey-responses: success", {
				surveyCount,
				totalResponses,
			});

			return {
				success: true,
				message,
				surveys,
				totalResponses,
			};
		} catch (error) {
			consola.error("search-survey-responses: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error searching survey responses",
				surveys: [],
				totalResponses: 0,
			};
		}
	},
});

interface ResponseRow {
	id: string;
	email: string | null;
	responses: Record<string, unknown> | null;
	completed: boolean;
	person_id: string | null;
	person: { id: string; name: string | null } | null;
}

function aggregateQuestionResponses(
	question: QuestionDefinition,
	responses: ResponseRow[],
	includeText: boolean,
	projectPath: string,
	surveyId: string
): QuestionSummary {
	const questionId = question.id;
	const answers: Array<{
		value: unknown;
		responseId: string;
		personName: string | null;
	}> = [];

	for (const response of responses) {
		const responseData = response.responses ?? {};
		if (questionId in responseData) {
			answers.push({
				value: responseData[questionId],
				responseId: response.id,
				personName: response.person?.name ?? null,
			});
		}
	}

	const summary: QuestionSummary = {
		questionId,
		prompt: question.prompt,
		type: question.type,
		responseCount: answers.length,
	};

	// Aggregate based on question type
	switch (question.type) {
		case "likert": {
			const numericValues = answers
				.map((a) => {
					const val = typeof a.value === "number" ? a.value : Number.parseInt(String(a.value), 10);
					return Number.isNaN(val) ? null : val;
				})
				.filter((v): v is number => v !== null);

			if (numericValues.length > 0) {
				const average = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
				const distribution: Record<string, number> = {};
				const scale = question.likertScale ?? 5;

				// Initialize all values in scale
				for (let i = 1; i <= scale; i++) {
					distribution[String(i)] = 0;
				}

				for (const val of numericValues) {
					distribution[String(val)] = (distribution[String(val)] ?? 0) + 1;
				}

				const percentages: Record<string, number> = {};
				for (const [key, count] of Object.entries(distribution)) {
					percentages[key] = Math.round((count / numericValues.length) * 100);
				}

				summary.stats = {
					average: Math.round(average * 100) / 100,
					distribution,
					percentages,
				};
			}
			break;
		}

		case "single_select":
		case "image_select": {
			const distribution: Record<string, number> = {};

			for (const answer of answers) {
				const val = String(answer.value ?? "");
				if (val) {
					distribution[val] = (distribution[val] ?? 0) + 1;
				}
			}

			if (Object.keys(distribution).length > 0) {
				const total = Object.values(distribution).reduce((sum, v) => sum + v, 0);
				const percentages: Record<string, number> = {};
				for (const [key, count] of Object.entries(distribution)) {
					percentages[key] = Math.round((count / total) * 100);
				}

				summary.stats = { distribution, percentages };
			}
			break;
		}

		case "multi_select": {
			const distribution: Record<string, number> = {};

			for (const answer of answers) {
				const values = Array.isArray(answer.value) ? answer.value : [answer.value];
				for (const val of values) {
					const strVal = String(val ?? "");
					if (strVal) {
						distribution[strVal] = (distribution[strVal] ?? 0) + 1;
					}
				}
			}

			if (Object.keys(distribution).length > 0) {
				// For multi-select, percentage is of respondents who selected each option
				const respondentCount = answers.length;
				const percentages: Record<string, number> = {};
				for (const [key, count] of Object.entries(distribution)) {
					percentages[key] = Math.round((count / respondentCount) * 100);
				}

				summary.stats = { distribution, percentages };
			}
			break;
		}

		case "short_text":
		case "long_text":
		case "auto": {
			if (includeText) {
				const textResponses: TextResponse[] = answers
					.filter((a) => a.value && String(a.value).trim().length > 0)
					.map((a) => ({
						answer: String(a.value),
						responseId: a.responseId,
						responseUrl: projectPath
							? `${projectPath}/ask/${surveyId}/responses/${a.responseId}`
							: `/ask/${surveyId}/responses/${a.responseId}`,
						personName: a.personName,
					}));

				if (textResponses.length > 0) {
					summary.textResponses = textResponses;
				}
			}
			break;
		}
	}

	return summary;
}
