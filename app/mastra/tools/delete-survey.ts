/**
 * Tool for deleting/archiving surveys (research_links)
 * Supports soft delete (archive) or hard delete
 */
import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { resolveProjectContext } from "./context-utils"

export const deleteSurveyTool = createTool({
	id: "delete-survey",
	description: `Delete or archive a survey (Ask link).

By default, this performs a SOFT DELETE by setting is_live to false and marking as archived.
This preserves the survey data and responses for historical reference.

Use hardDelete=true only when explicitly requested to permanently remove the survey and all its responses.`,
	inputSchema: z.object({
		projectId: z.string().nullish().describe("Project ID (defaults to runtime context)"),
		surveyId: z.string().describe("ID of the survey to delete"),
		hardDelete: z
			.boolean()
			.nullish()
			.default(false)
			.describe("If true, permanently deletes the survey and all responses. Default is false (soft delete/archive)."),
		reason: z.string().nullish().describe("Optional reason for deletion (stored in description for soft delete)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		deleted: z.boolean().describe("Whether the survey was deleted"),
		surveyId: z.string().optional(),
		surveyName: z.string().optional(),
		responseCount: z.number().optional().describe("Number of responses that were affected"),
	}),
	execute: async (input, context?) => {
		const { createSupabaseAdminClient } = await import("~/lib/supabase/client.server")
		const supabase = createSupabaseAdminClient()

		// Resolve project context
		let projectId: string

		try {
			const resolved = await resolveProjectContext(context, "delete-survey")
			projectId = input.projectId ?? resolved.projectId
		} catch (error) {
			const runtimeProjectId = context?.requestContext?.get?.("project_id")
			projectId = input.projectId ?? (runtimeProjectId ? String(runtimeProjectId).trim() : "")

			if (!projectId) {
				consola.error("delete-survey: No project context available")
				return {
					success: false,
					message: "Missing project context. Pass projectId parameter or ensure context is set.",
					deleted: false,
				}
			}
		}

		if (!input.surveyId) {
			return {
				success: false,
				message: "surveyId is required",
				deleted: false,
			}
		}

		consola.info("delete-survey: execute start", {
			projectId,
			surveyId: input.surveyId,
			hardDelete: input.hardDelete,
		})

		try {
			// First, fetch the survey to verify it exists and belongs to this project
			const { data: survey, error: fetchError } = await supabase
				.from("research_links")
				.select("id, name, project_id")
				.eq("id", input.surveyId)
				.eq("project_id", projectId)
				.maybeSingle()

			if (fetchError) {
				consola.error("delete-survey: fetch error", fetchError)
				return {
					success: false,
					message: `Database error: ${fetchError.message}`,
					deleted: false,
				}
			}

			if (!survey) {
				return {
					success: false,
					message: "Survey not found or does not belong to this project.",
					deleted: false,
				}
			}

			// Get response count
			const { count: responseCount } = await supabase
				.from("research_link_responses")
				.select("id", { count: "exact", head: true })
				.eq("research_link_id", input.surveyId)

			if (input.hardDelete) {
				// Hard delete: remove responses first, then the survey
				consola.warn("delete-survey: performing HARD DELETE", {
					surveyId: input.surveyId,
					surveyName: survey.name,
					responseCount,
				})

				// Delete all responses
				const { error: responsesDeleteError } = await supabase
					.from("research_link_responses")
					.delete()
					.eq("research_link_id", input.surveyId)

				if (responsesDeleteError) {
					consola.error("delete-survey: responses delete error", responsesDeleteError)
					return {
						success: false,
						message: `Failed to delete responses: ${responsesDeleteError.message}`,
						deleted: false,
					}
				}

				// Delete the survey
				const { error: surveyDeleteError } = await supabase
					.from("research_links")
					.delete()
					.eq("id", input.surveyId)
					.eq("project_id", projectId)

				if (surveyDeleteError) {
					consola.error("delete-survey: survey delete error", surveyDeleteError)
					return {
						success: false,
						message: `Failed to delete survey: ${surveyDeleteError.message}`,
						deleted: false,
					}
				}

				consola.info("delete-survey: hard delete success", {
					surveyId: input.surveyId,
					surveyName: survey.name,
					responsesDeleted: responseCount,
				})

				return {
					success: true,
					message: `Permanently deleted survey "${survey.name}" and ${responseCount ?? 0} responses.`,
					deleted: true,
					surveyId: input.surveyId,
					surveyName: survey.name,
					responseCount: responseCount ?? 0,
				}
			}

			// Soft delete: archive the survey
			const archiveDescription = input.reason
				? `[ARCHIVED: ${input.reason}] ${survey.name}`
				: `[ARCHIVED] ${survey.name}`

			const { error: updateError } = await supabase
				.from("research_links")
				.update({
					is_live: false,
					name: `[Archived] ${survey.name}`,
					description: archiveDescription,
					updated_at: new Date().toISOString(),
				})
				.eq("id", input.surveyId)
				.eq("project_id", projectId)

			if (updateError) {
				consola.error("delete-survey: archive error", updateError)
				return {
					success: false,
					message: `Failed to archive survey: ${updateError.message}`,
					deleted: false,
				}
			}

			consola.info("delete-survey: soft delete (archive) success", {
				surveyId: input.surveyId,
				surveyName: survey.name,
			})

			return {
				success: true,
				message: `Archived survey "${survey.name}". It is no longer accepting responses but data is preserved.`,
				deleted: true,
				surveyId: input.surveyId,
				surveyName: survey.name,
				responseCount: responseCount ?? 0,
			}
		} catch (error) {
			consola.error("delete-survey: unexpected error", error)
			return {
				success: false,
				message: error instanceof Error ? error.message : "Unexpected error deleting survey",
				deleted: false,
			}
		}
	},
})
