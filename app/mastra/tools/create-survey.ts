/**
 * Tool for creating and updating surveys (research_links).
 * Creates/updates the survey in the database and returns the URL for navigation.
 */

import { createTool } from "@mastra/core/tools"
import slugify from "@sindresorhus/slugify"
import consola from "consola"
import { customAlphabet } from "nanoid"
import { z } from "zod"

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)

const QuestionInputSchema = z.object({
	prompt: z.string().describe("The question text"),
	type: z
		.enum(["auto", "short_text", "long_text", "single_select", "multi_select", "likert"])
		.nullish()
		.default("auto")
		.describe("Question type - use 'auto' to let respondent choose"),
	required: z.boolean().optional().default(false),
	options: z.array(z.string()).optional().nullable().describe("Options for single_select or multi_select questions"),
	likertScale: z.number().min(3).max(10).optional().nullable().describe("Scale size for likert questions (3-10)"),
	likertLabels: z
		.object({
			low: z.string().optional(),
			high: z.string().optional(),
		})
		.nullish()
		.nullable()
		.describe("Labels for low/high ends of likert scale"),
})

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
	inputSchema: z.object({
		projectId: z.string().describe("Project ID - REQUIRED, get from context: project_id"),
		surveyId: z.string().nullish().describe("Survey ID - if provided, updates existing survey instead of creating new"),
		name: z.string().describe("Survey name/title"),
		description: z.string().optional().nullable().describe("Brief description of the survey purpose"),
		questions: z.array(QuestionInputSchema).min(1).describe("Array of questions to include"),
		isLive: z.boolean().optional().default(true).describe("Whether the survey is immediately live (default: true)"),
	}),
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
			// Use explicit projectId from input (required)
			const projectId = input.projectId

			// Get accountId from project record
			const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server")
			const supabase = createSupabaseAdminClient()

			const { data: project, error: projectError } = await supabase
				.from("projects")
				.select("account_id")
				.eq("id", projectId)
				.single()

			if (projectError || !project) {
				return {
					success: false,
					message: `Project not found: ${projectId}`,
					error: { code: "PROJECT_NOT_FOUND", message: "Invalid project ID" },
				}
			}

			const accountId = project.account_id

			// Transform questions to the expected format
			const questions = input.questions.map((q) => ({
				id: crypto.randomUUID(),
				prompt: q.prompt,
				type: q.type || "auto",
				required: q.required || false,
				placeholder: null,
				helperText: null,
				options: q.options || null,
				likertScale: q.likertScale || null,
				likertLabels: q.likertLabels || null,
				imageOptions: null,
				videoUrl: null,
			}))

			// UPDATE existing survey
			if (input.surveyId) {
				consola.info("create-survey: updating survey", {
					surveyId: input.surveyId,
					name: input.name,
					questionCount: questions.length,
				})

				const { data, error } = await supabase
					.from("research_links")
					.update({
						name: input.name,
						description: input.description || null,
						questions,
						is_live: input.isLive ?? true,
						hero_title: input.name,
						hero_subtitle: input.description || null,
					})
					.eq("id", input.surveyId)
					.select("id, slug")
					.single()

				if (error) {
					consola.error("create-survey: update error", error)
					return {
						success: false,
						message: `Failed to update survey: ${error.message}`,
						error: { code: error.code || "DB_ERROR", message: error.message },
					}
				}

				const editUrl = `/a/${accountId}/${projectId}/ask/${data.id}/edit`
				const publicUrl = `/research/${data.slug}`

				return {
					success: true,
					message: `Updated survey "${input.name}" with ${questions.length} questions.`,
					surveyId: data.id,
					editUrl,
					publicUrl,
				}
			}

			// CREATE new survey
			const baseSlug = slugify(input.name, { lowercase: true })
			const slug = `${baseSlug}-${nanoid()}`

			consola.info("create-survey: creating survey", {
				name: input.name,
				slug,
				questionCount: questions.length,
				projectId,
				accountId,
			})

			const { data, error } = await supabase
				.from("research_links")
				.insert({
					account_id: accountId,
					project_id: projectId,
					name: input.name,
					slug,
					description: input.description || null,
					questions,
					is_live: input.isLive ?? true,
					allow_chat: true,
					default_response_mode: "form",
					hero_title: input.name,
					hero_subtitle: input.description || null,
					hero_cta_label: "Start",
					hero_cta_helper: null,
				})
				.select("id, slug")
				.single()

			if (error) {
				consola.error("create-survey: database error", error)
				return {
					success: false,
					message: `Failed to create survey: ${error.message}`,
					error: { code: error.code || "DB_ERROR", message: error.message },
				}
			}

			const editUrl = `/a/${accountId}/${projectId}/ask/${data.id}/edit`
			const publicUrl = `/research/${data.slug}`

			consola.info("create-survey: survey created", {
				surveyId: data.id,
				editUrl,
				publicUrl,
			})

			return {
				success: true,
				message: `Created survey "${input.name}" with ${questions.length} questions. Navigate to the edit page to review and share.`,
				surveyId: data.id,
				editUrl,
				publicUrl,
			}
		} catch (error) {
			consola.error("create-survey: unexpected error", error)
			return {
				success: false,
				message: error instanceof Error ? error.message : "Failed to create survey",
				error: {
					code: "UNEXPECTED_ERROR",
					message: error instanceof Error ? error.message : "Failed to create survey",
				},
			}
		}
	},
})
