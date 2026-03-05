/**
 * Tool for creating and updating surveys (research_links).
 * Creates/updates the survey in the database and returns the URL for navigation.
 */

import { createTool } from "@mastra/core/tools";
import slugify from "@sindresorhus/slugify";
import consola from "consola";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import { validateUUID } from "./context-utils";
import {
	areCanonicallyEqual,
	asQuestionArray,
	isRetryableSurveyMutationError,
	resolveBoundSurveyTarget,
	withSurveyMutationRetry,
} from "./survey-mutation-guards";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

const QUESTION_TYPES = ["auto", "short_text", "long_text", "single_select", "multi_select", "likert"] as const;
type SurveyQuestionType = (typeof QUESTION_TYPES)[number];
const QUESTION_TYPE_SET = new Set<string>(QUESTION_TYPES);
const NPS_PROMPT_PATTERN =
	/\b(nps|net promoter|how likely are you to recommend|recommend (us|this|startupsd|our)\b|recommend .* (colleague|friend|peer))\b/i;

function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeTaxonomyKey(value: unknown): string | null {
	const raw = toNonEmptyString(value);
	if (!raw) return null;
	const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
	const aliases: Record<string, string> = {
		role: "role_type",
		role_type: "role_type",
		job_title: "job_title",
		title: "job_title",
		job_function: "job_function",
		function: "job_function",
		seniority: "seniority_level",
		seniority_level: "seniority_level",
		tenure: "tenure_in_role",
		tenure_in_role: "tenure_in_role",
		industry: "industry_vertical",
		industry_vertical: "industry_vertical",
		company_stage: "company_stage",
		stage: "company_stage",
		team_size: "team_size",
		company_size: "team_size",
		geographic_scope: "geographic_scope",
		funding_stage: "funding_stage",
		discovery_channel: "discovery_channel",
	};
	return aliases[key] ?? null;
}

function inferTaxonomyKeyFromPrompt(prompt: string): string | null {
	const patterns: Array<{ taxonomyKey: string; pattern: RegExp }> = [
		{ taxonomyKey: "job_title", pattern: /\b(job title|current title|professional title)\b/i },
		{ taxonomyKey: "job_function", pattern: /\b(job function|function|department)\b/i },
		{ taxonomyKey: "industry_vertical", pattern: /\b(industry|vertical|sector)\b/i },
		{ taxonomyKey: "role_type", pattern: /\b(primary role|best describes your role|role in)\b/i },
		{ taxonomyKey: "seniority_level", pattern: /\b(seniority|years? of experience|experience level)\b/i },
		{ taxonomyKey: "tenure_in_role", pattern: /\b(years? in (your )?role|tenure in role)\b/i },
		{ taxonomyKey: "team_size", pattern: /\b(team size|how many (people|employees)|company size)\b/i },
		{ taxonomyKey: "company_stage", pattern: /\b(company stage|startup stage|business stage|arr)\b/i },
		{ taxonomyKey: "funding_stage", pattern: /\b(funding stage|pre-seed|seed|series [a-z])\b/i },
		{ taxonomyKey: "discovery_channel", pattern: /\b(how did you hear|discovery channel|heard about)\b/i },
		{ taxonomyKey: "geographic_scope", pattern: /\b(geographic scope|region|where.*operate|market scope)\b/i },
	];
	for (const entry of patterns) {
		if (entry.pattern.test(prompt)) return entry.taxonomyKey;
	}
	return null;
}

function derivePersonFieldKey(taxonomyKey: string | null): string | null {
	if (!taxonomyKey) return null;
	if (taxonomyKey === "job_title") return "title";
	if (taxonomyKey === "job_function") return "job_function";
	if (taxonomyKey === "seniority_level" || taxonomyKey === "tenure_in_role") return "seniority_level";
	if (taxonomyKey === "role_type") return "role";
	return null;
}

function normalizeSurveyQuestion(input: Record<string, unknown>, index: number) {
	const prompt = toNonEmptyString(input.prompt) ?? `Question ${index + 1}`;
	const isNpsPrompt = NPS_PROMPT_PATTERN.test(prompt);
	const explicitTaxonomy = normalizeTaxonomyKey(input.taxonomyKey);
	const taxonomyKey = explicitTaxonomy ?? inferTaxonomyKeyFromPrompt(prompt);
	const explicitPersonFieldKey = toNonEmptyString(input.personFieldKey);
	const personFieldKey = explicitPersonFieldKey ?? derivePersonFieldKey(taxonomyKey);

	const rawType = typeof input.type === "string" ? input.type : "";
	let type: SurveyQuestionType = QUESTION_TYPE_SET.has(rawType) ? (rawType as SurveyQuestionType) : "auto";

	const required = input.required === true;

	const options =
		Array.isArray(input.options) && input.options.length > 0
			? input.options
					.map((option) => {
						if (typeof option === "string") return option.trim();
						if (option === null || option === undefined) return "";
						return String(option).trim();
					})
					.filter((option) => option.length > 0)
			: null;

	const rawLikertScale =
		typeof input.likertScale === "number"
			? input.likertScale
			: typeof input.likertScale === "string" && input.likertScale.trim().length > 0
				? Number(input.likertScale)
				: null;
	let likertScale =
		typeof rawLikertScale === "number" && Number.isFinite(rawLikertScale) ? Math.round(rawLikertScale) : null;
	if (likertScale !== null && (likertScale < 3 || likertScale > 10)) {
		likertScale = null;
	}

	const rawLikertLabels =
		input.likertLabels && typeof input.likertLabels === "object" && !Array.isArray(input.likertLabels)
			? (input.likertLabels as { low?: unknown; high?: unknown })
			: null;
	let likertLabels =
		rawLikertLabels !== null
			? {
					low: toNonEmptyString(rawLikertLabels.low),
					high: toNonEmptyString(rawLikertLabels.high),
				}
			: null;

	if (type === "likert") {
		if (isNpsPrompt) {
			likertScale = 10;
			likertLabels ??= { low: "1 = Not at all likely", high: "10 = Extremely likely" };
		} else {
			likertScale ??= 5;
			likertLabels ??= { low: null, high: null };
		}
		return {
			id: crypto.randomUUID(),
			prompt,
			type,
			required,
			placeholder: null,
			helperText: null,
			options: null,
			likertScale,
			likertLabels,
			imageOptions: null,
			videoUrl: null,
			taxonomyKey,
			personFieldKey,
		};
	}

	if ((type === "single_select" || type === "multi_select") && (!options || options.length === 0)) {
		type = "auto";
	}

	return {
		id: crypto.randomUUID(),
		prompt,
		type,
		required,
		placeholder: null,
		helperText: null,
		options: type === "single_select" || type === "multi_select" ? options : null,
		likertScale: null,
		likertLabels: null,
		imageOptions: null,
		videoUrl: null,
		taxonomyKey,
		personFieldKey,
	};
}

export const createSurveyTool = createTool({
	id: "create-survey",
	description: `Create a new survey (Ask Link) with pre-populated questions.
Use this when the user wants to create a survey. You provide the name, description, and questions -
the tool creates it in the database and returns the URL to view/edit it.

IMPORTANT: After calling this tool, ALWAYS call "navigateToPage" with the returned editUrl to take the user there.

Question types:
- "auto": Let respondent choose how to answer (text, voice, etc.)
- "short_text": Single line text input
- "long_text": Multi-line text area
- "single_select": Choose one option from a list (requires options array)
- "multi_select": Choose multiple options (requires options array)
- "likert": Rating scale (use likertScale for size, likertLabels for endpoints)
- NPS standard in this product: use 1-10 scale with labeled endpoints`,
	inputSchema: z
		.object({
			projectId: z
				.string()
				.nullish()
				.default("")
				.describe("Project ID - use context project_id when missing from model output"),
			name: z.string().describe("Survey name/title"),
			description: z.string().nullish().default(null).describe("Brief description of the survey purpose"),
			questions: z
				.array(z.record(z.unknown()))
				.min(1)
				.describe(
					"Array of question objects. Missing fields are normalized server-side (type/required/options/likertScale/likertLabels). Optional metadata: taxonomyKey and personFieldKey for canonical response mapping."
				),
			isLive: z.boolean().nullish().describe("Whether the survey is immediately live (default: true)"),
		})
		.passthrough(),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		surveyId: z.string().optional(),
		questionCount: z.number().nullish(),
		editUrl: z.string().nullish().describe("Relative URL to edit the survey - use with navigateToPage"),
		publicUrl: z.string().nullish().describe("Public URL where respondents can take the survey"),
		error: z
			.object({
				code: z.string(),
				message: z.string(),
			})
			.optional(),
	}),
	execute: async (input, context?) => {
		try {
			const contextProjectId = context?.requestContext?.get?.("project_id");
			const projectId =
				toNonEmptyString(input.projectId) ??
				(typeof contextProjectId === "string" ? toNonEmptyString(contextProjectId) : null);
			if (!projectId) {
				return {
					success: false,
					message: "Missing projectId for survey creation.",
					error: { code: "MISSING_PROJECT_ID", message: "Could not resolve projectId from input or request context" },
				};
			}

			const surveyName = toNonEmptyString(input.name) ?? "Untitled Survey";
			const surveyDescription = toNonEmptyString(input.description) ?? null;
			const surveyIdFromInput = validateUUID((input as { surveyId?: unknown }).surveyId, "surveyId", "create-survey");
			const rawSurveyIdFromInput = toNonEmptyString((input as { surveyId?: unknown }).surveyId);
			if (rawSurveyIdFromInput && !surveyIdFromInput) {
				return {
					success: false,
					message: "surveyId must be a valid UUID when provided.",
					questionCount: null,
					error: { code: "INVALID_SURVEY_ID", message: "Provided surveyId is not a valid UUID" },
				};
			}
			const isLive = input.isLive ?? true;

			// Get accountId from project record
			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			const { data: project, error: projectError } = await withSurveyMutationRetry({
				operation: "create-survey.load-project",
				run: async () => {
					const result = await supabase.from("projects").select("account_id").eq("id", projectId).single();
					if (result.error && isRetryableSurveyMutationError(result.error)) {
						throw result.error;
					}
					return result;
				},
			});

			if (projectError || !project) {
				return {
					success: false,
					message: `Project not found: ${projectId}`,
					error: { code: "PROJECT_NOT_FOUND", message: "Invalid project ID" },
				};
			}

			const accountId = project.account_id;

			// Accept loose LLM payloads and normalize into DB-safe question records.
			const questions = input.questions.map((question, index) =>
				normalizeSurveyQuestion((question as Record<string, unknown>) ?? {}, index)
			);

			// UPDATE existing survey
			if (surveyIdFromInput) {
				const {
					survey: existingSurvey,
					surveyId,
					projectId: boundProjectId,
				} = await resolveBoundSurveyTarget({
					context,
					toolName: "create-survey",
					supabase,
					surveyIdInput: surveyIdFromInput,
					select: "id, slug, name, description, is_live, hero_title, hero_subtitle, questions, project_id, account_id",
				});
				const persistedProjectId = boundProjectId;

				consola.info("create-survey: updating survey", {
					surveyId,
					name: surveyName,
					questionCount: questions.length,
				});

				const { data, error } = await withSurveyMutationRetry({
					operation: "create-survey.update-survey",
					run: async () => {
						const result = await supabase
							.from("research_links")
							.update({
								name: surveyName,
								description: surveyDescription,
								questions,
								is_live: isLive,
								hero_title: surveyName,
								hero_subtitle: surveyDescription,
							})
							.eq("id", surveyId)
							.eq("project_id", persistedProjectId)
							.select("id, slug")
							.single();
						if (result.error && isRetryableSurveyMutationError(result.error)) {
							throw result.error;
						}
						return result;
					},
				});

				if (error) {
					consola.error("create-survey: update error", error);
					return {
						success: false,
						message: `Failed to update survey: ${error.message}`,
						error: { code: error.code || "DB_ERROR", message: error.message },
					};
				}

				const { data: persistedSurvey, error: persistedError } = await withSurveyMutationRetry({
					operation: "create-survey.verify-update",
					run: async () => {
						const result = await supabase
							.from("research_links")
							.select("id, slug, name, description, is_live, hero_title, hero_subtitle, questions")
							.eq("id", surveyId)
							.eq("project_id", persistedProjectId)
							.single();
						if (result.error && isRetryableSurveyMutationError(result.error)) {
							throw result.error;
						}
						return result;
					},
				});

				if (persistedError || !persistedSurvey) {
					return {
						success: false,
						message: "Saved survey update but failed to verify persisted state. Please refresh and retry.",
						surveyId,
						questionCount: null,
						error: { code: "VERIFY_READ_FAILED", message: "Unable to load persisted survey after update" },
					};
				}

				const expectedFields: Record<string, unknown> = {
					name: surveyName,
					description: surveyDescription,
					is_live: isLive,
					hero_title: surveyName,
					hero_subtitle: surveyDescription,
				};
				const mismatchedFields = Object.entries(expectedFields)
					.filter(
						([field, expected]) => !areCanonicallyEqual((persistedSurvey as Record<string, unknown>)[field], expected)
					)
					.map(([field]) => field);
				const persistedQuestions = asQuestionArray(persistedSurvey.questions);
				if (!areCanonicallyEqual(persistedQuestions, questions)) {
					mismatchedFields.push("questions");
				}
				if (mismatchedFields.length > 0) {
					consola.error("create-survey: update verification mismatch", {
						surveyId,
						mismatchedFields,
						existingSurveyId: existingSurvey.id,
					});
					return {
						success: false,
						message: `Survey update verification failed for: ${mismatchedFields.join(", ")}.`,
						surveyId,
						questionCount: persistedQuestions.length,
						error: { code: "VERIFY_MISMATCH", message: `Mismatched fields: ${mismatchedFields.join(", ")}` },
					};
				}

				const editUrl = `/a/${accountId}/${projectId}/ask/${persistedSurvey.id}/edit`;
				const publicUrl = `/research/${data.slug}`;

				return {
					success: true,
					message: `Updated survey "${surveyName}" with ${persistedQuestions.length} questions.`,
					surveyId: persistedSurvey.id,
					questionCount: persistedQuestions.length,
					editUrl,
					publicUrl,
				};
			}

			// CREATE new survey
			const baseSlug = slugify(surveyName, { lowercase: true });
			const slug = `${baseSlug}-${nanoid()}`;

			consola.info("create-survey: creating survey", {
				name: surveyName,
				slug,
				questionCount: questions.length,
				projectId,
				accountId,
			});

			const { data, error } = await withSurveyMutationRetry({
				operation: "create-survey.insert",
				run: async () => {
					const result = await supabase
						.from("research_links")
						.insert({
							account_id: accountId,
							project_id: projectId,
							name: surveyName,
							slug,
							description: surveyDescription,
							questions,
							is_live: isLive,
							allow_chat: true,
							default_response_mode: "form",
							hero_title: surveyName,
							hero_subtitle: surveyDescription,
							hero_cta_label: "Start",
							hero_cta_helper: null,
						})
						.select("id, slug")
						.single();
					if (result.error && isRetryableSurveyMutationError(result.error)) {
						throw result.error;
					}
					return result;
				},
			});

			if (error) {
				consola.error("create-survey: database error", error);
				return {
					success: false,
					message: `Failed to create survey: ${error.message}`,
					error: { code: error.code || "DB_ERROR", message: error.message },
				};
			}

			const editUrl = `/a/${accountId}/${projectId}/ask/${data.id}/edit`;
			const publicUrl = `/research/${data.slug}`;

			const { data: persistedSurvey, error: persistedError } = await withSurveyMutationRetry({
				operation: "create-survey.verify-insert",
				run: async () => {
					const result = await supabase
						.from("research_links")
						.select("id, slug, project_id, account_id, name, description, is_live, questions")
						.eq("id", data.id)
						.eq("project_id", projectId)
						.single();
					if (result.error && isRetryableSurveyMutationError(result.error)) {
						throw result.error;
					}
					return result;
				},
			});

			if (persistedError || !persistedSurvey) {
				return {
					success: false,
					message: "Created survey but failed to verify persisted state. Please refresh and retry.",
					surveyId: data.id,
					questionCount: null,
					error: { code: "VERIFY_READ_FAILED", message: "Unable to load persisted survey after create" },
				};
			}

			const expectedCreateFields: Record<string, unknown> = {
				project_id: projectId,
				account_id: accountId,
				name: surveyName,
				description: surveyDescription,
				is_live: isLive,
			};
			const createMismatchFields = Object.entries(expectedCreateFields)
				.filter(
					([field, expected]) => !areCanonicallyEqual((persistedSurvey as Record<string, unknown>)[field], expected)
				)
				.map(([field]) => field);
			const persistedQuestions = asQuestionArray(persistedSurvey.questions);
			if (!areCanonicallyEqual(persistedQuestions, questions)) {
				createMismatchFields.push("questions");
			}
			if (createMismatchFields.length > 0) {
				consola.error("create-survey: create verification mismatch", {
					surveyId: data.id,
					createMismatchFields,
				});
				return {
					success: false,
					message: `Survey create verification failed for: ${createMismatchFields.join(", ")}.`,
					surveyId: data.id,
					questionCount: persistedQuestions.length,
					error: { code: "VERIFY_MISMATCH", message: `Mismatched fields: ${createMismatchFields.join(", ")}` },
				};
			}

			consola.info("create-survey: survey created", {
				surveyId: data.id,
				editUrl,
				publicUrl,
			});

			return {
				success: true,
				message: `Created survey "${surveyName}" with ${persistedQuestions.length} questions. Navigate to the edit page to review and share.`,
				surveyId: data.id,
				questionCount: persistedQuestions.length,
				editUrl,
				publicUrl,
			};
		} catch (error) {
			consola.error("create-survey: unexpected error", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to create survey",
				error: {
					code: "UNEXPECTED_ERROR",
					message: error instanceof Error ? error.message : "Failed to create survey",
				},
			};
		}
	},
});
