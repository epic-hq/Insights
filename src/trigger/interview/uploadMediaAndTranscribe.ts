import { metadata, task } from "@trigger.dev/sdk"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import {
	type UploadMediaAndTranscribePayload,
	uploadMediaAndTranscribeCore,
	workflowRetryConfig,
} from "~/utils/processInterview.server"

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error)
}

export const uploadMediaAndTranscribeTask = task({
	id: "interview.upload-media-and-transcribe",
	retry: workflowRetryConfig,
	run: async (payload: UploadMediaAndTranscribePayload) => {
		const client = createSupabaseAdminClient()
		let interviewId = payload.existingInterviewId ?? null

		try {
			metadata.set("stageLabel", "Normalizing transcript")
			metadata.set("progressPercent", 10)
			if (payload.analysisJobId) {
				metadata.set("analysisJobId", payload.analysisJobId)
			}
			if (payload.metadata.accountId) {
				metadata.set("accountId", payload.metadata.accountId)
			}
			if (payload.metadata.projectId) {
				metadata.set("projectId", payload.metadata.projectId)
			}

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "in_progress",
						status_detail: "Normalizing transcript",
						progress: 10,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const uploadResult = await uploadMediaAndTranscribeCore({ ...payload, client })
			interviewId = uploadResult.interview.id

			metadata.set("interviewId", uploadResult.interview.id)
			metadata.set("stageLabel", "Preparing evidence extraction")
			metadata.set("progressPercent", 35)

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status_detail: "Extracting evidence",
						progress: 25,
					})
					.eq("id", payload.analysisJobId as string)
			}

			const { extractEvidenceAndPeopleTask } = await import("./extractEvidenceAndPeople")
			metadata.set("stageLabel", "Extracting evidence and participants")
			metadata.set("progressPercent", 55)
			const nextResult = await extractEvidenceAndPeopleTask.triggerAndWait({
				...uploadResult,
				analysisJobId: payload.analysisJobId,
				userCustomInstructions: payload.userCustomInstructions,
			})

			if (!nextResult.ok) {
				throw new Error(
					nextResult.error?.message ?? "Failed to extract people and evidence from interview transcript."
				)
			}

			metadata.set("stageLabel", "Evidence extraction complete")
			metadata.set("progressPercent", 100)

			return nextResult.output
		} catch (error) {
			metadata.set("stageLabel", "Processing failed")
			metadata.set("progressPercent", 0)

			if (payload.analysisJobId) {
				await client
					.from("analysis_jobs")
					.update({
						status: "error",
						status_detail: "Upload and transcription normalization failed",
						last_error: errorMessage(error),
					})
					.eq("id", payload.analysisJobId as string)
			}

			if (interviewId) {
				await client
					.from("interviews")
					.update({ status: "error" })
					.eq("id", interviewId as string)
			}

			throw error
		}
	},
})
