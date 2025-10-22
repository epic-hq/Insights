import { createWriteStream, readFileSync } from "node:fs"
import { unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, posix } from "node:path"
import { randomUUID } from "node:crypto"
import { pipeline } from "node:stream/promises"
import { execa } from "execa"
import ffmpeg from "ffmpeg-static"
import { task, metadata } from "@trigger.dev/sdk"
import consola from "consola"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { createR2PresignedUrl, uploadToR2 } from "~/utils/r2.server"
import { getRecallBot, mapRecallStatusToJobStatus } from "~/utils/recall.server"
import { normalizeRecallTranscript } from "~/utils/transcript/normalizeRecallTranscript.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"
import {
	processInterviewTranscriptWithAdminClient,
	type UploadMediaAndTranscribePayload,
} from "~/utils/processInterview.server"

interface RecallRecording {
	media_shortcuts?: Record<string, unknown>
	[key: string]: unknown
}

const RECORDING_PREFERENCE = ["video_mixed", "video", "audio_mixed", "audio"]

const TRANSCRIPT_PREFERENCE = ["transcript", "captions"]

interface RecallIngestPayload {
	meetingBotId: string
	botId: string
	uploadJobId?: string | null
}

type JsonRecord = Record<string, unknown>

const coerceDownloadUrl = (recording: RecallRecording | null | undefined, pathKeys: string[]): string | null => {
	if (!recording) return null
	const shortcuts = recording.media_shortcuts as Record<string, any> | undefined
	if (!shortcuts) return null
	for (const key of pathKeys) {
		const data = shortcuts[key]
		const url =
			typeof data?.download_url === "string"
				? data.download_url
				: typeof data?.data?.download_url === "string"
					? data.data.download_url
					: null
		if (url) return url
	}
	return null
}

const extensionFromContentType = (contentType: string | null): string => {
	if (!contentType) return "bin"
	if (contentType.includes("mp4")) return "mp4"
	if (contentType.includes("mpeg")) return "mp3"
	if (contentType.includes("wav")) return "wav"
	if (contentType.includes("json")) return "json"
	if (contentType.includes("plain")) return "txt"
	return contentType.split("/").pop() || "bin"
}

const buildR2Key = (projectId: string, interviewId: string, suffix: string) => {
	const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "")
	const safeInterview = interviewId.replace(/[^a-zA-Z0-9_-]/g, "")
	return posix.join("interviews", safeProject, `${safeInterview}-${suffix}`)
}

const downloadToFile = async (url: string): Promise<{ path: string; contentType: string | null }> => {
	const response = await fetch(url)
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download Recall asset: ${response.status} ${response.statusText}`)
	}

	const contentType = response.headers.get("content-type")
	const tmpPath = join(tmpdir(), `recall-${randomUUID()}`)
	await pipeline(response.body, createWriteStream(tmpPath))

	return { path: tmpPath, contentType }
}

const uploadBufferToR2 = async (key: string, filePath: string, contentType: string | null) => {
	const buffer = readFileSync(filePath)
	const uploadResult = await uploadToR2({
		key,
		body: buffer,
		contentType: contentType ?? undefined,
	})

	if (!uploadResult.success) {
		throw new Error(`Failed to upload ${key} to R2: ${uploadResult.error ?? "unknown error"}`)
	}

	const presigned = createR2PresignedUrl({ key, expiresInSeconds: 24 * 60 * 60 })
	return { key, url: presigned?.url ?? null }
}

const processTranscript = (payload: unknown) => {
	const normalized = normalizeRecallTranscript(payload)
	return safeSanitizeTranscriptPayload({
		...normalized,
	})
}

const updateJobStatus = async (
	supabase: ReturnType<typeof createSupabaseAdminClient>,
	uploadJobId: string | null | undefined,
	status: "pending" | "in_progress" | "done" | "error" | "retry",
	statusDetail: string | null,
	extra?: JsonRecord,
) => {
	if (!uploadJobId) return
	await supabase
		.from("upload_jobs")
		.update({
			status,
			status_detail: statusDetail,
			...(extra ?? {}),
		})
		.eq("id", uploadJobId)
}

export const ingestRecallBotTask = task({
	id: "recall.ingest-bot",
	maxDuration: 900,
	run: async (payload: RecallIngestPayload) => {
		const supabase = createSupabaseAdminClient()
		metadata.set("meetingBotId", payload.meetingBotId)
		const tempFiles: string[] = []

		try {
			const { data: meetingBot, error: meetingBotError } = await supabase
			.from("meeting_bots")
			.select(
				"*, interview:interview_id (id, account_id, project_id, title, interview_date, media_url, raw_media_url, processed_media_url, created_by, updated_by, participant_pseudonym, segment)",
			)
			.eq("id", payload.meetingBotId)
			.single()

			if (meetingBotError || !meetingBot) {
				throw new Error(`Meeting bot ${payload.meetingBotId} not found: ${meetingBotError?.message}`)
			}

			if (!meetingBot.interview) {
				throw new Error("Meeting bot is missing associated interview record")
			}

			const interview = meetingBot.interview as JsonRecord
			const projectId = interview.project_id as string
			const interviewId = interview.id as string
			const accountId = interview.account_id as string
			const initiatingUser =
				(typeof interview.updated_by === "string" && interview.updated_by) ||
				(typeof interview.created_by === "string" && interview.created_by) ||
				undefined

			metadata.set("interviewId", interviewId)

			const recallBot = await getRecallBot(payload.botId)
			const recordings = Array.isArray(recallBot.recordings) ? (recallBot.recordings as RecallRecording[]) : []

			const chosenRecording =
				recordings.find((recording) => coerceDownloadUrl(recording, RECORDING_PREFERENCE)) ?? recordings[0]

			const videoUrl = coerceDownloadUrl(chosenRecording, RECORDING_PREFERENCE)
			const transcriptUrl = coerceDownloadUrl(chosenRecording, TRANSCRIPT_PREFERENCE)

			if (!videoUrl) {
				throw new Error("Recall bot recording does not include a downloadable media URL")
			}

			metadata.set("stageLabel", "Downloading recording")
			const rawDownload = await downloadToFile(videoUrl)
			tempFiles.push(rawDownload.path)

			const suffix = Date.now().toString()
			const rawExtension = extensionFromContentType(rawDownload.contentType)
			const rawKey = buildR2Key(projectId, interviewId, `recall-${suffix}.${rawExtension}`)

			const { key: rawKeyUploaded, url: rawUrl } = await uploadBufferToR2(
				rawKey,
				rawDownload.path,
				rawDownload.contentType,
			)

		let processedUrl: string | null = null
		let processedKey: string | null = null
			const processedPath = join(tmpdir(), `recall-processed-${randomUUID()}.mp3`)
			tempFiles.push(processedPath)

			if (!ffmpeg) {
				throw new Error("ffmpeg binary not found")
			}

			metadata.set("stageLabel", "Transcoding audio")

			await execa(ffmpeg, [
				"-hide_banner",
				"-y",
				"-i",
				rawDownload.path,
				"-ac",
				"1",
				"-ar",
				"16000",
				"-b:a",
				"32k",
				processedPath,
			])

			const processedKeyCandidate = buildR2Key(projectId, interviewId, `recall-${suffix}.mp3`)
			const { key: uploadedProcessedKey, url: uploadedProcessedUrl } = await uploadBufferToR2(
				processedKeyCandidate,
				processedPath,
				"audio/mpeg",
			)
			processedKey = uploadedProcessedKey
			processedUrl = uploadedProcessedUrl

		try {
			await supabase
				.from("meeting_bots")
				.update({
					raw_recording_key: rawKeyUploaded,
					raw_recording_url: rawUrl,
					processed_recording_key: processedKey,
					processed_recording_url: processedUrl,
					transcript_download_url: transcriptUrl ?? null,
				})
				.eq("id", meetingBot.id)
		} catch (error) {
			consola.error("Failed to update meeting bot with recording links", error)
		}

		const mediaUpdate: JsonRecord = {}
		if (rawUrl) mediaUpdate.raw_media_url = rawUrl
		if (processedUrl) {
			mediaUpdate.processed_media_url = processedUrl
			if (!interview.media_url) {
				mediaUpdate.media_url = processedUrl
			}
		}

		if (Object.keys(mediaUpdate).length > 0) {
			await supabase.from("interviews").update(mediaUpdate).eq("id", interviewId)
		}

		const { data: uploadJob } = await supabase
			.from("upload_jobs")
			.select("id, custom_instructions")
			.eq("meeting_bot_id", meetingBot.id)
			.maybeSingle()

		const { data: uploadJob } = await supabase
			.from("upload_jobs")
			.select("id, custom_instructions")
			.eq("meeting_bot_id", meetingBot.id)
			.maybeSingle()

		const uploadJobId = payload.uploadJobId ?? uploadJob?.id ?? null

		if (uploadJobId) {
			await supabase
				.from("upload_jobs")
				.update({
					raw_media_key: rawKeyUploaded,
					processed_media_key: processedKey,
					processed_media_url: processedUrl,
					transcript_download_url: transcriptUrl ?? null,
				})
				.eq("id", uploadJobId)
		}

		let sanitizedTranscript: UploadMediaAndTranscribePayload["transcriptData"] | null = null

		if (transcriptUrl) {
			metadata.set("stageLabel", "Downloading transcript")
			const transcriptResponse = await fetch(transcriptUrl)
			if (transcriptResponse.ok) {
				const text = await transcriptResponse.text()
				try {
					const parsed = JSON.parse(text)
					sanitizedTranscript = processTranscript(parsed) as unknown as UploadMediaAndTranscribePayload["transcriptData"]
				} catch (error) {
					consola.error("Failed to parse Recall transcript JSON", error)
				}
			} else {
				consola.error("Failed to download Recall transcript", transcriptResponse.status, transcriptResponse.statusText)
			}
		}

		if (!sanitizedTranscript) {
			throw new Error("Recall transcript could not be normalized")
		}

		const metadataPayload = {
			accountId,
			projectId,
			userId: initiatingUser ?? undefined,
			interviewTitle: (interview.title as string | null) ?? undefined,
			interviewDate: (interview.interview_date as string | null) ?? undefined,
			participantName: (interview.participant_pseudonym as string | null) ?? undefined,
			segment: (interview.segment as string | null) ?? undefined,
		}

		metadata.set("stageLabel", "Running interview pipeline")
		await updateJobStatus(supabase, uploadJobId, "in_progress", "Processing Recall transcript")

		const transcriptResult = await processInterviewTranscriptWithAdminClient({
			metadata: metadataPayload,
			mediaUrl: processedUrl ?? rawUrl ?? "",
			transcriptData: sanitizedTranscript,
			userCustomInstructions: (uploadJob?.custom_instructions as string | null) ?? undefined,
			adminClient: supabase,
			existingInterviewId: interviewId,
		})

		await supabase
			.from("meeting_bots")
			.update({
				status: "done",
				status_detail: "Interview pipeline completed",
				recall_status: recallBot.status ?? "done",
				last_status_at: new Date().toISOString(),
			})
			.eq("id", meetingBot.id)

		await updateJobStatus(supabase, uploadJobId, "done", "Recall interview processed successfully")

		return {
			interviewId,
			meetingBotId: meetingBot.id,
			processedEvidence: transcriptResult.stored,
		}
		} finally {
			await Promise.allSettled(tempFiles.map((file) => unlink(file).catch(() => {})))
		}
	},
	onFailure: async ({ error, payload }) => {
		consola.error("Recall ingest task failed", { error, payload })
		const supabase = createSupabaseAdminClient()
		const jobStatus = mapRecallStatusToJobStatus("error")
		await updateJobStatus(supabase, payload.uploadJobId, jobStatus, error instanceof Error ? error.message : "Recall ingest failed")
		await supabase
			.from("meeting_bots")
			.update({
				status: jobStatus,
				status_detail: error instanceof Error ? error.message : "Recall ingest failed",
			})
			.eq("id", payload.meetingBotId)
	},
	finally: async ({}) => {
		// cleanup temp files handled inline above
	},
})
