import consola from "consola"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Json, Database, Interview, InterviewInsert } from "~/types"
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"
import type { UploadAndTranscribePayload, UploadAndTranscribeResult, InterviewMetadata } from "./types"

export async function uploadMediaAndTranscribeCore({
	metadata,
	transcriptData,
	mediaUrl,
	existingInterviewId,
	client,
}: UploadAndTranscribePayload & {
	client: SupabaseClient<Database>
}): Promise<{
	metadata: InterviewMetadata
	interview: Interview
	sanitizedTranscriptData: Record<string, unknown>
	transcriptData: Record<string, unknown>
	fullTranscript: string
	language: string
}> {
	const normalizedMetadata: InterviewMetadata = { ...metadata }

	// Check if data is already sanitized (has non-empty speaker_transcripts array)
	// If so, don't re-sanitize as it will strip all the fields
	const isAlreadySanitized =
		transcriptData &&
		typeof transcriptData === "object" &&
		"speaker_transcripts" in transcriptData &&
		Array.isArray((transcriptData as any).speaker_transcripts) &&
		(transcriptData as any).speaker_transcripts.length > 0

	consola.info("[uploadMediaAndTranscribeCore] Sanitization check", {
		isAlreadySanitized,
		hasTranscriptData: !!transcriptData,
		transcriptDataKeys: transcriptData && typeof transcriptData === "object" ? Object.keys(transcriptData) : [],
		hasSpeakerTranscripts:
			transcriptData && typeof transcriptData === "object" && "speaker_transcripts" in transcriptData,
		speakerTranscriptsCount:
			transcriptData &&
			typeof transcriptData === "object" &&
			"speaker_transcripts" in transcriptData &&
			Array.isArray((transcriptData as any).speaker_transcripts)
				? (transcriptData as any).speaker_transcripts.length
				: 0,
	})

	const sanitizedTranscriptData = isAlreadySanitized
		? (transcriptData as any)
		: safeSanitizeTranscriptPayload(transcriptData)
	const normalizedTranscriptData = sanitizedTranscriptData as unknown as Record<string, unknown>

	consola.info("[uploadMediaAndTranscribeCore] After sanitization", {
		fullTranscriptLength: sanitizedTranscriptData.full_transcript?.length ?? 0,
		speakerTranscriptsCount: sanitizedTranscriptData.speaker_transcripts?.length ?? 0,
		sanitizedKeys: Object.keys(sanitizedTranscriptData),
	})

	if (normalizedMetadata.projectId) {
		const { data: projectRow } = await client
			.from("projects")
			.select("account_id")
			.eq("id", normalizedMetadata.projectId)
			.single()
		if (projectRow?.account_id && normalizedMetadata.accountId !== projectRow.account_id) {
			consola.warn("Overriding metadata.accountId with project account", {
				provided: normalizedMetadata.accountId,
				projectAccount: projectRow.account_id,
			})
			normalizedMetadata.accountId = projectRow.account_id
		}
	}

	// Get full transcript for legacy purposes (not used in AI extraction anymore)
	const fullTranscript = (sanitizedTranscriptData.full_transcript ?? "") as string
	const language =
		(normalizedTranscriptData as any).language || (normalizedTranscriptData as any).detected_language || "en"

	let interviewRecord: Interview
	consola.log("assembly audio_duration ", sanitizedTranscriptData.audio_duration)
	if (existingInterviewId) {
		consola.info("uploadMediaAndTranscribeCore: fetching existing interview", {
			existingInterviewId,
		})
		const { data: existing, error: fetchErr } = await client
			.from("interviews")
			.select("*")
			.eq("id", existingInterviewId)
			.maybeSingle()

		if (fetchErr) {
			consola.error("uploadMediaAndTranscribeCore: error fetching existing interview", {
				existingInterviewId,
				error: fetchErr,
				code: fetchErr.code,
				details: fetchErr.details,
				hint: fetchErr.hint,
			})
			throw new Error(`Error fetching existing interview ${existingInterviewId}: ${fetchErr.message}`)
		}

		if (!existing) {
			consola.error("uploadMediaAndTranscribeCore: existing interview not found", { existingInterviewId })
			throw new Error(`Existing interview ${existingInterviewId} not found in database`)
		}

		consola.info("uploadMediaAndTranscribeCore: updating existing interview", {
			existingInterviewId,
			currentStatus: existing.status,
		})

		const { data: updated, error: updateErr } = await client
			.from("interviews")
			.update({
				status: "processing",
				transcript: fullTranscript,
				transcript_formatted: sanitizedTranscriptData as unknown as Json,
				duration_sec: sanitizedTranscriptData.audio_duration ?? null,
			})
			.eq("id", existingInterviewId)
			.select("*")
			.maybeSingle()

		if (updateErr) {
			consola.error("uploadMediaAndTranscribeCore: error updating existing interview", {
				existingInterviewId,
				error: updateErr,
				code: updateErr.code,
				details: updateErr.details,
				hint: updateErr.hint,
			})
			throw new Error(`Failed to update existing interview: ${updateErr.message}`)
		}

		if (!updated) {
			consola.error("uploadMediaAndTranscribeCore: update returned no data", {
				existingInterviewId,
			})
			throw new Error(`Failed to update existing interview ${existingInterviewId} - no data returned`)
		}

		interviewRecord = updated as unknown as Interview
		consola.info("uploadMediaAndTranscribeCore: successfully updated existing interview", {
			interviewId: interviewRecord.id,
			status: interviewRecord.status,
		})
	} else {
		const interviewData: InterviewInsert = {
			account_id: normalizedMetadata.accountId,
			project_id: normalizedMetadata.projectId,
			title: normalizedMetadata.interviewTitle || normalizedMetadata.fileName,
			interview_date: normalizedMetadata.interviewDate || new Date().toISOString().split("T")[0],
			participant_pseudonym: normalizedMetadata.participantName || "Anonymous",
			segment: normalizedMetadata.segment || null,
			media_url: mediaUrl || null,
			transcript: fullTranscript,
			transcript_formatted: sanitizedTranscriptData as unknown as Json,
			duration_sec: sanitizedTranscriptData.audio_duration ?? null,
			status: "processing" as const,
		} as InterviewInsert

		const { data: created, error: interviewError } = await client
			.from("interviews")
			.insert(interviewData)
			.select()
			.single()
		if (interviewError || !created) {
			throw new Error(`Failed to create interview record: ${interviewError?.message}`)
		}
		interviewRecord = created as unknown as Interview
	}

	if (normalizedMetadata.projectId && interviewRecord?.id) {
		if (normalizedMetadata.userId) {
			try {
				await ensureInterviewInterviewerLink({
					supabase: client,
					accountId: normalizedMetadata.accountId,
					projectId: normalizedMetadata.projectId ?? null,
					interviewId: interviewRecord.id,
					userId: normalizedMetadata.userId,
				})
			} catch (linkError) {
				consola.warn("uploadMediaAndTranscribeCore: failed to link internal interviewer", linkError)
			}
		}

		await createPlannedAnswersForInterview(client, {
			projectId: normalizedMetadata.projectId,
			interviewId: interviewRecord.id,
		})
	}

	return {
		metadata: normalizedMetadata,
		interview: interviewRecord,
		sanitizedTranscriptData: sanitizedTranscriptData as unknown as Record<string, unknown>,
		transcriptData: normalizedTranscriptData,
		fullTranscript,
		language,
	}
}
