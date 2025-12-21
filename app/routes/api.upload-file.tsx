import type { UUID } from "node:crypto"
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { ensureInterviewInterviewerLink } from "~/features/people/services/internalPeople.server"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getServerClient } from "~/lib/supabase/client.server"
import { userContext } from "~/server/user-context"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"
import { storeAudioFile } from "~/utils/storeAudioFile.server"
import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

// Remix action to handle multipart/form-data file uploads, stream the file to
// AssemblyAI's /upload endpoint, then run the existing transcript->insights pipeline.
export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const ctx = context.get(userContext)
	const userId = ctx?.claims?.sub ?? null
	const supabase = ctx?.supabase ?? getServerClient(request).client

	const formData = await request.formData()
	const file = formData.get("file") as File | null
	if (!file) {
		return Response.json({ error: "No file uploaded" }, { status: 400 })
	}
	// const body = formData.get("body") as string | null
	const projectId = formData.get("projectId") as UUID
	const participant_name = formData.get("participantName")?.toString() || null
	const participant_organization =
		formData.get("participantOrganization")?.toString() || formData.get("participantCompany")?.toString() || null
	const segment = formData.get("segment")?.toString() || null

	if (!projectId) {
		return Response.json({ error: "No projectId provided" }, { status: 400 })
	}

	// Resolve the team account associated with this project to avoid using personal user IDs
	const { data: projectRow, error: projectError } = await supabase
		.from("projects")
		.select("account_id")
		.eq("id", projectId)
		.single()

	if (projectError || !projectRow?.account_id) {
		consola.error("Unable to resolve project account", projectId, projectError)
		return Response.json({ error: "Unable to resolve project account" }, { status: 404 })
	}

	const accountId = projectRow.account_id
	consola.log(`api.upload-file resolved accountId: ${accountId}, projectId: ${projectId}`)

	const interviewTitle = `Interview - ${format(new Date(), "yyyy-MM-dd")}`

	try {
		// Check if file is text/markdown - handle directly without AssemblyAI
		const isTextFile =
			file.type.startsWith("text/") ||
			file.name.endsWith(".txt") ||
			file.name.endsWith(".md") ||
			file.name.endsWith(".markdown")

		let transcriptData: Record<string, unknown>
		let mediaUrl: string

		// Detect file type for source_type field up front
		const fileExtension = file.name.split(".").pop()?.toLowerCase() || ""
		let sourceType = "audio_upload"
		if (file.type.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm"].includes(fileExtension)) {
			sourceType = "video_upload"
		}
		if (isTextFile) {
			sourceType = "document"
		}

		// Create interview record upfront (used as analysisJobId)
		const { data: interview, error: insertError } = await supabase
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title: isTextFile ? `Text Interview - ${format(new Date(), "yyyy-MM-dd")}` : interviewTitle,
				status: "uploading",
				original_filename: file.name,
				source_type: sourceType,
				file_extension: fileExtension,
			})
			.select()
			.single()

		if (insertError || !interview) {
			return Response.json({ error: "Failed to create interview record" }, { status: 500 })
		}

		const interviewId = interview.id

		if (userId) {
			await ensureInterviewInterviewerLink({
				supabase,
				accountId,
				projectId,
				interviewId: interview.id,
				userId,
				userSettings: ctx.user_settings || null,
				userMetadata: ctx.user_metadata || null,
			})
		}

		await createPlannedAnswersForInterview(supabase, { projectId, interviewId: interview.id })

		if (isTextFile) {
			// Handle text/markdown files - read content directly
			consola.log("Processing text/markdown file:", file.name)
			const textContent = await file.text()

			if (!textContent || textContent.trim().length === 0) {
				return Response.json({ error: "Text file is empty or could not be read" }, { status: 400 })
			}

			// Create transcript data object matching expected format
			transcriptData = safeSanitizeTranscriptPayload({
				full_transcript: textContent.trim(),
				audio_duration: null, // No audio duration for text files
				file_type: "text",
				original_filename: file.name,
			})
			mediaUrl = "" // No media URL for text files

			consola.log(
				"Text file processed:",
				`${textContent.length} characters\n${textContent.slice(0, 500)}${textContent.length > 500 ? "..." : ""}`
			)
		} else {
			// Handle audio/video files - store file and transcribe

			// Store audio file in Cloudflare R2
			consola.log("Storing audio file in Cloudflare R2...")
			const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile({
				projectId,
				interviewId: interview.id,
				source: file,
				originalFilename: file.name,
				contentType: file.type,
			})

			if (storageError || !storedMediaUrl) {
				return Response.json({ error: `Failed to store audio file: ${storageError}` }, { status: 500 })
			}

			mediaUrl = storedMediaUrl

			// Transcribe directly from R2 public URL (no need to upload to AssemblyAI)
			// AssemblyAI will download the file from R2 server-to-server (faster + more reliable)
			consola.log("Starting transcription from R2 URL:", storedMediaUrl)
			transcriptData = await transcribeAudioFromUrl(storedMediaUrl)
			consola.log(
				"Transcription result:",
				transcriptData.audio_duration,
				transcriptData
					? `${(transcriptData.full_transcript as string).length} characters\n${(transcriptData.full_transcript as string).slice(0, 500)}`
					: "null/empty"
			)

			if (!transcriptData || !(transcriptData.full_transcript as string)?.trim().length) {
				return Response.json({ error: "Transcription failed or returned empty result" }, { status: 400 })
			}

			// Update interview with media URL
			await supabase.from("interviews").update({ media_url: mediaUrl, status: "transcribed" }).eq("id", interview.id)
		}

		const metadata = {
			accountId,
			projectId,
			userId: userId ?? undefined,
			fileName: file?.name,
			interviewTitle: isTextFile ? `Text Interview - ${format(new Date(), "yyyy-MM-dd")}` : interviewTitle,
			participantName: participant_name ?? "Anonymous",
			participantOrganization: participant_organization ?? undefined,
			segment: segment ?? "Unknown",
		}

		const userCustomInstructions = formData.get("userCustomInstructions")?.toString() || ""

		// 3. Persist transcript to interview for resumeFrom: evidence
		const transcriptString = (transcriptData?.full_transcript as string) || ""
		await supabase
			.from("interviews")
			.update({
				transcript: transcriptString,
				transcript_formatted: transcriptData as unknown as Record<string, unknown>,
				status: "transcribed",
				media_url: mediaUrl,
			})
			.eq("id", interviewId)

		// 4. Trigger v2 orchestrator starting from evidence (skip upload)
		const handle = await tasks.trigger("interview.v2.orchestrator", {
			analysisJobId: interviewId,
			metadata,
			transcriptData,
			mediaUrl,
			userCustomInstructions,
			existingInterviewId: interviewId,
			resumeFrom: "evidence",
			skipSteps: ["upload"],
		})

		return Response.json({ success: true, interviewId, runId: handle.id })
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
