/**
 * Tool for saving research link responses during chat
 * Uses shared db functions from research-links feature
 */
import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { markResearchLinkComplete, saveResearchLinkAnswer } from "~/features/research-links/db"
import { supabaseAdmin } from "~/lib/supabase/client.server"

export const saveResearchResponseTool = createTool({
	id: "save-research-response",
	description: "Save a user's answer to a survey question. Call this immediately after the user answers each question.",
	inputSchema: z.object({
		questionId: z.string().describe("The question ID to save the answer for"),
		answer: z
			.union([z.string(), z.array(z.string())])
			.describe("The user's answer - string for text, array for multi-select"),
		responseId: z.string().describe("The response ID for this survey session"),
		slug: z.string().describe("The survey slug"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		questionId: z.string().optional(),
	}),
	execute: async (input) => {
		const { questionId, answer, responseId } = input
		consola.info("save-research-response: TOOL CALLED", {
			questionId,
			answer,
			responseId,
		})

		const result = await saveResearchLinkAnswer({
			supabase: supabaseAdmin,
			responseId,
			questionId,
			answer,
		})

		if (!result.success) {
			consola.error("save-research-response: FAILED", { error: result.error })
			return { success: false, message: result.error ?? "Unknown error" }
		}

		consola.info("save-research-response: SUCCESS", { questionId })
		return { success: true, message: "Saved", questionId }
	},
})

export const markSurveyCompleteTool = createTool({
	id: "mark-survey-complete",
	description: "Mark the survey as complete when all questions have been answered. Call this after the final question.",
	inputSchema: z.object({
		responseId: z.string().describe("The response ID for this survey session"),
		slug: z.string().describe("The survey slug"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
	}),
	execute: async (input) => {
		const { responseId } = input
		consola.info("mark-survey-complete: TOOL CALLED", { responseId })

		const result = await markResearchLinkComplete({
			supabase: supabaseAdmin,
			responseId,
		})

		if (!result.success) {
			consola.error("mark-survey-complete: FAILED", { error: result.error })
			return { success: false, message: result.error ?? "Unknown error" }
		}

		consola.info("mark-survey-complete: SUCCESS")
		return { success: true, message: "Survey marked complete" }
	},
})
