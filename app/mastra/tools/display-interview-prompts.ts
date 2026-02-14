/**
 * Display Interview Prompts Tool
 *
 * Generates interview prompts for a project and renders them as a
 * gen-ui surface via the A2UI protocol. Uses withA2UI() to ensure
 * the a2ui payload survives Mastra's Zod output validation.
 */

import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { buildSingleComponentSurface, withA2UI } from "~/lib/gen-ui/tool-helpers"

const baseOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
})

export const displayInterviewPromptsTool = createTool({
	id: "display-interview-prompts",
	description:
		"Display interactive interview prompts as a rich UI component. Use this when the user asks for interview questions, prompts, or a discussion guide. The prompts will appear as an editable checklist the user can customize.",
	inputSchema: z.object({
		title: z
			.string()
			.optional()
			.describe("Title for the prompts section, e.g. 'Customer Discovery Questions'"),
		description: z
			.string()
			.optional()
			.describe("Brief description of what these prompts cover"),
		prompts: z
			.array(
				z.object({
					id: z.string().describe("Unique ID for the prompt"),
					text: z.string().describe("The interview question text"),
					status: z.enum(["planned", "answered", "skipped"]).default("planned"),
					isMustHave: z.boolean().optional().describe("Whether this is a critical question"),
					category: z.string().optional().describe("Category grouping for the question"),
				}),
			)
			.describe("Array of interview prompts/questions to display"),
	}),
	outputSchema: withA2UI(baseOutputSchema),
	execute: async (input, context?) => {
		const project_id = context?.requestContext?.get?.("project_id") as string | undefined
		const thread_id = context?.requestContext?.get?.("thread_id") as string | undefined

		consola.info("[gen-ui] displayInterviewPrompts called", {
			project_id,
			promptCount: input.prompts?.length ?? 0,
			title: input.title,
		})

		const surfaceId = thread_id ?? project_id ?? `prompts-${Date.now()}`

		const prompts = (input.prompts ?? []).map((p, i) => ({
			id: p.id || `prompt-${i}`,
			text: p.text,
			status: p.status || "planned",
			isMustHave: p.isMustHave ?? false,
			category: p.category,
		}))

		return {
			success: true,
			message: `Displaying ${prompts.length} interview prompts${input.title ? ` for "${input.title}"` : ""}`,
			a2ui: buildSingleComponentSurface({
				surfaceId,
				componentType: "InterviewPrompts",
				data: {
					title: input.title ?? "Interview Prompts",
					description: input.description,
					prompts,
				},
			}),
		}
	},
})
