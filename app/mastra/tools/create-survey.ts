/**
 * Tool for creating and updating surveys (research_links).
 * Creates/updates the survey in the database and returns the URL for navigation.
 */

import { createTool } from "@mastra/core/tools";
import slugify from "@sindresorhus/slugify";
import consola from "consola";
import { customAlphabet } from "nanoid";
import { z } from "zod";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

const QUESTION_TYPES = ["auto", "short_text", "long_text", "single_select", "multi_select", "likert"] as const;
type SurveyQuestionType = (typeof QUESTION_TYPES)[number];
const QUESTION_TYPE_SET = new Set<string>(QUESTION_TYPES);

function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeSurveyQuestion(input: Record<string, unknown>, index: number) {
	const prompt = toNonEmptyString(input.prompt) ?? `Question ${index + 1}`;

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
		likertScale ??= 5;
		likertLabels ??= { low: null, high: null };
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
- "likert": Rating scale (use likertScale for size, likertLabels for endpoints)`,
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
					"Array of question objects. Missing fields are normalized server-side (type/required/options/likertScale/likertLabels)."
				),
			isLive: z.boolean().nullish().describe("Whether the survey is immediately live (default: true)"),
		})
		.passthrough(),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		surveyId: z.string().optional(),
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
			const surveyId =
				typeof (input as { surveyId?: unknown }).surveyId === "string" &&
				(input as { surveyId?: string }).surveyId?.trim()
					? ((input as { surveyId?: string }).surveyId ?? null)
					: null;
			const isLive = input.isLive ?? true;

			// Get accountId from project record
			const { createSupabaseAdminClient } = await import("../../lib/supabase/client.server");
			const supabase = createSupabaseAdminClient();

			const { data: project, error: projectError } = await supabase
				.from("projects")
				.select("account_id")
				.eq("id", projectId)
				.single();

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
			if (surveyId) {
				consola.info("create-survey: updating survey", {
					surveyId,
					name: surveyName,
					questionCount: questions.length,
				});

				const { data, error } = await supabase
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
					.select("id, slug")
					.single();

				if (error) {
					consola.error("create-survey: update error", error);
					return {
						success: false,
						message: `Failed to update survey: ${error.message}`,
						error: { code: error.code || "DB_ERROR", message: error.message },
					};
				}

				const editUrl = `/a/${accountId}/${projectId}/ask/${data.id}/edit`;
				const publicUrl = `/research/${data.slug}`;

				return {
					success: true,
					message: `Updated survey "${surveyName}" with ${questions.length} questions.`,
					surveyId: data.id,
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

			const { data, error } = await supabase
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

			consola.info("create-survey: survey created", {
				surveyId: data.id,
				editUrl,
				publicUrl,
			});

			return {
				success: true,
				message: `Created survey "${surveyName}" with ${questions.length} questions. Navigate to the edit page to review and share.`,
				surveyId: data.id,
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
