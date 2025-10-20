import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
	type AttributeAnswersTaskPayload,
	attributeAnswersAndFinalizeCore,
	workflowRetryConfig,
} from "~/utils/processInterview.server"

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const attributeAnswersTask = task({
	id: "interview.attribute-answers",
	retry: workflowRetryConfig,
	run: async (payload: AttributeAnswersTaskPayload) => {
		if (process.env.ENABLE_PERSONA_ANALYSIS !== "true") {
			return { interviewId: payload.interview.id, storedInsights: payload.storedInsights ?? [] }
		}

		const client = createSupabaseAdminClient()

		try {
			await attributeAnswersAndFinalizeCore({
				db: client,
				metadata: payload.metadata,
				interviewRecord: payload.interview,
				insertedEvidenceIds: payload.insertedEvidenceIds,
				storedInsights: payload.storedInsights,
				fullTranscript: payload.fullTranscript,
			})

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "done",
						status_detail: "Analysis complete",
						progress: 100,
						last_error: null,
					})
					.eq("id", payload.analysisJobId as string)
			}

			return { interviewId: payload.interview.id, storedInsights: payload.storedInsights }
		} catch (error) {
			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Attributing answers failed",
						last_error: errorMessage(error),
					})
					.eq("id", payload.analysisJobId as string)
			}

			await client.from("interviews").update({ status: "error" }).eq("id", payload.interview.id)

			throw error
		}
	},
})
