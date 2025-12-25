/**
 * Tool for saving research link responses during chat
 */
import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"

export const saveResearchResponseTool = createTool({
	id: "save-research-response",
	description: "Save a user's answer to a survey question. Call this immediately after the user answers each question.",
	inputSchema: z.object({
		questionId: z.string().describe("The question ID to save the answer for"),
		answer: z
			.union([z.string(), z.array(z.string())])
			.describe("The user's answer - string for text, array for multi-select"),
	}),
	execute: async ({ context, questionId, answer }) => {
		const responseId = context?.requestContext?.get("response_id")

		if (!responseId) {
			return { success: false, error: "No response ID in context" }
		}

		// Get current responses
		const { data: existing, error: fetchError } = await supabaseAdmin
			.from("research_link_responses")
			.select("responses")
			.eq("id", responseId)
			.maybeSingle()

		if (fetchError) {
			return { success: false, error: fetchError.message }
		}

		const currentResponses = (existing?.responses as Record<string, unknown>) ?? {}
		const updatedResponses = {
			...currentResponses,
			[questionId]: answer,
		}

		// Save updated responses
		const { error: updateError } = await supabaseAdmin
			.from("research_link_responses")
			.update({ responses: updatedResponses })
			.eq("id", responseId)

		if (updateError) {
			return { success: false, error: updateError.message }
		}

		return { success: true, questionId, saved: true }
	},
})

export const markSurveyCompleteTool = createTool({
	id: "mark-survey-complete",
	description: "Mark the survey as complete when all questions have been answered. Call this after the final question.",
	inputSchema: z.object({}),
	execute: async ({ context }) => {
		const responseId = context?.requestContext?.get("response_id")

		if (!responseId) {
			return { success: false, error: "No response ID in context" }
		}

		const { error } = await supabaseAdmin
			.from("research_link_responses")
			.update({ completed_at: new Date().toISOString() })
			.eq("id", responseId)

		if (error) {
			return { success: false, error: error.message }
		}

		return { success: true, completed: true }
	},
})
