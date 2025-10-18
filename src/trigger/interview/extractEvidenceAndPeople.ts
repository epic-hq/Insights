import { task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
	type UploadMediaAndTranscribeResult,
	extractEvidenceAndPeopleCore,
	workflowRetryConfig,
} from "~/utils/processInterview.server"

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const extractEvidenceAndPeopleTask = task({
	id: "interview.extract-evidence-and-people",
	retry: workflowRetryConfig,
	run: async (payload: UploadMediaAndTranscribeResult) => {
		const client = createSupabaseAdminClient()

		try {
			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status_detail: "Extracting evidence and participants",
						progress: 50,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const evidenceResult = await extractEvidenceAndPeopleCore({
				db: client,
				metadata: payload.metadata,
				interviewRecord: payload.interview,
				transcriptData: payload.transcriptData,
				language: payload.language,
				fullTranscript: payload.fullTranscript,
			})

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "done",
						status_detail: "Evidence extraction complete",
						progress: 100,
						last_error: null,
						evidence_count: evidenceResult.insertedEvidenceIds.length,
					})
					.eq("id", payload.analysisJobId as string)
			}

			await client
				.from("interviews")
				.update({
					status: "ready",
					evidence_count: evidenceResult.insertedEvidenceIds.length,
					updated_at: new Date().toISOString(),
				})
				.eq("id", payload.interview.id)

			return {
				interviewId: payload.interview.id,
				evidenceResult,
			}
		} catch (error) {
			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Evidence extraction failed",
						last_error: errorMessage(error),
					})
					.eq("id", payload.analysisJobId as string)
			}

			await client.from("interviews").update({ status: "error" }).eq("id", payload.interview.id)

			throw error
		}
	},
})
