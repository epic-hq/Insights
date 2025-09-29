import consola from "consola"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/../supabase/types"
import { processInterviewTranscriptWithClient, type InterviewMetadata } from "~/utils/processInterview.server"

interface RegenerateEvidenceOptions {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	userId?: string
}

export interface RegenerateEvidenceResult {
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
		.select(
			"id, transcript, transcript_formatted, media_url, title, interview_date, participant_pseudonym, segment"
		)
		.eq("project_id", projectId)

	if (interviewsError) {
		throw new Error(`Failed to load interviews: ${interviewsError.message}`)
	}

	if (!interviews?.length) {
		return { processed, skipped, errors }
	}

	for (const interview of interviews as Array<Database["public"]["Tables"]["interviews"]["Row"]>) {
		try {
			const rawTranscriptData = (interview.transcript_formatted as Record<string, unknown> | null) ?? {}
			const transcriptData: Record<string, unknown> = { ...rawTranscriptData }
			const fullTranscript = typeof transcriptData.full_transcript === "string" && transcriptData.full_transcript.trim().length
				? transcriptData.full_transcript
				: interview.transcript ?? ""

			if (!fullTranscript.trim().length) {
				skipped += 1
				continue
			}

			transcriptData.full_transcript = fullTranscript
			if (!transcriptData.language) {
				transcriptData.language = (transcriptData as { detected_language?: string }).detected_language || "en"
			}

			await supabase.from("evidence").delete().eq("interview_id", interview.id)

			const metadata: InterviewMetadata = {
				accountId,
				projectId,
				userId,
				interviewTitle: interview.title || undefined,
				interviewDate: interview.interview_date ? new Date(interview.interview_date).toISOString().split("T")[0] : undefined,
				participantName: interview.participant_pseudonym || undefined,
				segment: interview.segment || undefined,
			}

			await processInterviewTranscriptWithClient({
				metadata,
				mediaUrl: interview.media_url || "",
				transcriptData,
				userCustomInstructions: undefined,
				client: supabase,
				existingInterviewId: interview.id,
			})

			processed += 1
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			errors.push({ interviewId: interview.id, message })
			consola.warn(`Failed to regenerate evidence for interview ${interview.id}: ${message}`)
		}
	}

	return { processed, skipped, errors }
}
