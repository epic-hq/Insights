import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { getProjectContextGeneric } from "~/features/questions/db"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { projectGoalsSchema } from "~/schemas"
import type { Database } from "~/types"

export const fetchProjectGoalsTool = createTool({
	id: "fetch-project-goals",
	description:
		"Fetch project goals and research context including target organizations, roles, research goals, decision questions, assumptions, unknowns, and settings. Useful for understanding ICP, decision criteria, and research scope.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch goals from. Defaults to the current project in context."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		projectGoals: projectGoalsSchema.nullable(),
	}),
	execute: async (context, _options) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context.runtimeContext?.get?.("project_id")
		const runtimeAccountId = context.runtimeContext?.get?.("account_id")

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const projectId = (context as any).projectId ?? runtimeProjectId ?? null

		consola.info("fetch-project-goals: execute start", {
			projectId,
			accountId: runtimeAccountId,
		})

		if (!projectId) {
			consola.warn("fetch-project-goals: missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				projectGoals: null,
			}
		}

		// At this point, projectId is guaranteed to be a string
		const projectIdStr = projectId as string

		try {
			// Use the existing project context function to get merged sections
			const projectContext = await getProjectContextGeneric(supabase, projectIdStr)

			if (!projectContext?.merged) {
				consola.info("fetch-project-goals: no project sections found")
				return {
					success: true,
					message: "No project goals found for this project.",
					projectId,
					projectGoals: null,
				}
			}

			const merged = projectContext.merged

			// Extract and transform the data to match our schema
			const projectGoals = {
				projectId: projectIdStr,
				targetOrgs: Array.isArray(merged.target_orgs) ? (merged.target_orgs as string[]) : null,
				targetRoles: Array.isArray(merged.target_roles) ? (merged.target_roles as string[]) : null,
				researchGoal: typeof merged.research_goal === "string" ? merged.research_goal : null,
				researchGoalDetails: typeof merged.research_goal_details === "string" ? merged.research_goal_details : null,
				decisionQuestions: Array.isArray(merged.decision_questions) ? (merged.decision_questions as string[]) : null,
				assumptions: Array.isArray(merged.assumptions) ? (merged.assumptions as string[]) : null,
				unknowns: Array.isArray(merged.unknowns) ? (merged.unknowns as string[]) : null,
				customInstructions: typeof merged.custom_instructions === "string" ? merged.custom_instructions : null,
				settings:
					typeof merged === "object" && merged !== null && "research_mode" in merged
						? {
								research_mode: merged.research_mode,
								conversation_type: merged.conversation_type,
								target_conversations: merged.target_conversations,
								interview_duration: merged.interview_duration,
							}
						: null,
			}

			return {
				success: true,
				message: "Successfully fetched project goals.",
				projectId: projectIdStr,
				projectGoals,
			}
		} catch (error) {
			consola.error("fetch-project-goals: unexpected error", error)
			return {
				success: false,
				message: "Unexpected error fetching project goals.",
				projectId: projectIdStr,
				projectGoals: null,
			}
		}
	},
})
