/**
 * V2 Assign Personas Task
 *
 * Atomic task that:
 * 1. Auto-assigns personas based on evidence facets via auto-grouping
 * 2. Queries resulting persona assignments
 * 3. Can run in parallel with attributeAnswersTask
 *
 * Fully idempotent - can be safely retried.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"
import {
	errorMessage,
	saveWorkflowState,
	updateAnalysisJobError,
	updateAnalysisJobProgress,
} from "./state"
import type { AssignPersonasPayload, AssignPersonasResult } from "./types"

export const assignPersonasTaskV2 = task({
	id: "interview.v2.assign-personas",
	retry: workflowRetryConfig,
	run: async (payload: AssignPersonasPayload): Promise<AssignPersonasResult> => {
		const { interviewId, projectId, personId, analysisJobId } = payload
		const client = createSupabaseAdminClient()

		try {
			await updateAnalysisJobProgress(client, analysisJobId, {
				currentStep: "personas",
				progress: 80,
				statusDetail: "Assigning personas",
			})

			// Auto-group themes and apply persona assignments
			// This function handles persona assignment via facet analysis
			try {
				// Dynamically import to avoid circular dependencies
				const { autoGroupThemesAndApply } = await import("~/features/themes/db.autoThemes.server")

				// Get account_id from interview
				const { data: interview } = await client
					.from("interviews")
					.select("account_id")
					.eq("id", interviewId)
					.single()

				if (interview?.account_id) {
					await autoGroupThemesAndApply({
						supabase: client as any,
						account_id: interview.account_id,
						project_id: projectId ?? null,
						limit: 200,
					})
				}
			} catch (themeErr) {
				consola.warn("Auto theme grouping failed; continuing without auto-grouping", themeErr)
			}

			// Query assigned personas (auto-assigned via triggers or auto-grouping)
			let personaIds: string[] = []

			if (personId) {
				const { data: personaAssignments } = await client
					.from("people_personas")
					.select("persona_id")
					.eq("person_id", personId)
					.eq("project_id", projectId)

				personaIds = (personaAssignments || []).map((p) => p.persona_id)
			}

			// Update workflow state
			if (analysisJobId) {
				await saveWorkflowState(client, analysisJobId, {
					personaIds,
					completedSteps: ["upload", "evidence", "insights", "personas"],
					currentStep: "personas",
					interviewId,
				})
			}

			consola.success(`[assignPersonas] Assigned ${personaIds.length} personas`)

			return {
				personaIds,
			}
		} catch (error) {
			await updateAnalysisJobError(client, analysisJobId, {
				currentStep: "personas",
				error: errorMessage(error),
			})

			throw error
		}
	},
})
