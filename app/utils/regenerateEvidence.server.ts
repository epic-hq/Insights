import type { SupabaseClient } from "@supabase/supabase-js"
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { uploadMediaAndTranscribeTask } from "~/../../src/trigger/interview/uploadMediaAndTranscribe"
import type { Database } from "~/../supabase/types"
import type { InterviewMetadata } from "~/utils/processInterview.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

interface RegenerateEvidenceOptions {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	userId?: string
}

interface RegenerateEvidenceResult {
	processed: number
	skipped: number
	errors: Array<{ interviewId: string; message: string }>
}

export async function regenerateEvidenceForProject({
	supabase,
	accountId,
	projectId,
	userId,
}: RegenerateEvidenceOptions): Promise<RegenerateEvidenceResult> {
	const errors: Array<{ interviewId: string; message: string }> = []
	let processed = 0
	let skipped = 0

	const { data: interviews, error: interviewsError } = await supabase
		.from("interviews")
		.select("id, transcript, transcript_formatted, media_url, title, interview_date, participant_pseudonym, segment")
		.eq("project_id", projectId)

	if (interviewsError) {
		throw new Error(`Failed to load interviews: ${interviewsError.message}`)
	}

	if (!interviews?.length) {
		return { processed, skipped, errors }
	}

	for (const interview of interviews as Array<Database["public"]["Tables"]["interviews"]["Row"]>) {
		try {
			const sanitized = safeSanitizeTranscriptPayload(interview.transcript_formatted)
			const fullTranscriptCandidate =
				typeof sanitized.full_transcript === "string" && sanitized.full_transcript.trim().length
					? sanitized.full_transcript
					: (interview.transcript ?? "")

			if (!fullTranscriptCandidate.trim().length) {
				skipped += 1
				continue
			}

			const transcriptData: Record<string, unknown> = {
				...sanitized,
				full_transcript: fullTranscriptCandidate,
				language:
					sanitized.language ||
					sanitized.language_code ||
					(sanitized as unknown as { detected_language?: string }).detected_language ||
					"en",
			}

			// Delete existing evidence to regenerate
			await supabase.from("evidence").delete().eq("interview_id", interview.id)

			const metadata: InterviewMetadata = {
				accountId: interview.account_id,
				userId: interview.created_by || undefined,
				projectId: interview.project_id || undefined,
				interviewTitle: interview.title || undefined,
				interviewDate: interview.interview_date || undefined,
				participantName: interview.participant_pseudonym || undefined,
				duration_sec: interview.duration_sec || undefined,
				segment: interview.segment || undefined,
			}

			// Generate fresh presigned URL from R2 key if needed
			let mediaUrlForTask = interview.media_url || ""
			if (mediaUrlForTask && !mediaUrlForTask.startsWith("http://") && !mediaUrlForTask.startsWith("https://")) {
				// It's an R2 key, generate presigned URL
				const { createR2PresignedUrl } = await import("~/utils/r2.server")
				const presigned = createR2PresignedUrl({
					key: mediaUrlForTask,
					expiresInSeconds: 24 * 60 * 60, // 24 hours
				})
				if (presigned) {
					mediaUrlForTask = presigned.url
					consola.log(`Generated presigned URL for regeneration of interview ${interview.id}`)
				}
			}

			// Use Trigger.dev task instead of duplicating core logic
			// This ensures consistent behavior and single source of truth
			const result = await tasks.trigger<typeof uploadMediaAndTranscribeTask>("interview.upload-media-and-transcribe", {
				metadata,
				mediaUrl: mediaUrlForTask,
				transcriptData,
				userCustomInstructions: undefined,
				existingInterviewId: interview.id,
				// No analysisJobId for regeneration - this is a background operation
			})

			consola.info(`Triggered regeneration for interview ${interview.id}, run ID: ${result.id}`)

			processed += 1
			consola.success(`Successfully triggered regeneration for interview ${interview.id}`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			errors.push({ interviewId: interview.id, message })
			consola.error(`Failed to trigger regeneration for interview ${interview.id}: ${message}`)
		}
	}

	return { processed, skipped, errors }
}
