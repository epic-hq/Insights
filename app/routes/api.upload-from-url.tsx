import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { getServerClient } from "~/lib/supabase/server"
import { userContext } from "~/server/user-context"
import { transcribeRemoteFile } from "~/utils/assemblyai.server"
import { processInterviewTranscript } from "~/utils/processInterview.server"
import { storeAudioFile } from "~/utils/storeAudioFile.server"

// Utility: convert Google Drive share link to direct-download URL
function toDirectDownloadUrl(url: string): string {
	// Handles various Google Drive share link formats and returns a direct-download URL.
	const patterns = [
		/https?:\/\/drive\.google\.com\/file\/d\/([\w-]+)\//, // .../file/d/<id>/view
		/https?:\/\/drive\.google\.com\/open\?id=([\w-]+)/, // .../open?id=<id>
		/https?:\/\/drive\.google\.com\/uc\?id=([\w-]+)&?.*/, // already uc format
	]
	for (const p of patterns) {
		const m = url.match(p)
		if (m) {
			const id = m[1]
			// add confirm param to skip virus scan/redirect HTML
			return `https://drive.google.com/uc?export=download&id=${id}&confirm=t`
		}
	}
	return url // non-GDrive URL stays unchanged
}

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const ctx = context.get(userContext)
	const supabase = ctx?.supabase ?? getServerClient(request).client
	const userId = ctx?.claims?.sub ?? null

	try {
		const formData = await request.formData()
		const projectId = formData.get("projectId") as UUID
		const url = formData.get("url") as string
		consola.log("url", url)
		if (!url || !projectId) {
			return Response.json({ error: "URL and projectId are required" }, { status: 400 })
		}
		const directUrl = toDirectDownloadUrl(url)

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

		// First create interview record to get ID for storage
		const { data: interview, error: insertError } = await supabase
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: projectId,
				title: `Interview - ${format(new Date(), "yyyy-MM-dd")}`,
				status: "uploading",
			})
			.select()
			.single()

		if (insertError || !interview) {
			return Response.json({ error: "Failed to create interview record" }, { status: 500 })
		}

		await createPlannedAnswersForInterview(supabase, { projectId, interviewId: interview.id })

		// Store audio file from URL in Cloudflare R2
		consola.log("Storing audio file from URL in Cloudflare R2...")
		const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile({
			projectId,
			interviewId: interview.id,
			source: directUrl,
			originalFilename: url,
		})

		if (storageError || !storedMediaUrl) {
			consola.warn("Failed to store audio file, continuing with original URL:", storageError)
			// Continue with original URL if storage fails
		}

		// 1. Upload then transcribe via AssemblyAI
		consola.log("Starting transcription for URL:", directUrl)
		const transcriptData = await transcribeRemoteFile(directUrl)
		consola.log("Transcription result:", transcriptData ? `${transcriptData.length} characters` : "null/empty")

		if (!transcriptData || transcriptData.full_transcript.trim().length === 0) {
			return Response.json({ error: "Transcription failed or returned empty result" }, { status: 400 })
		}

		// Use stored URL if available, otherwise fall back to original URL
		const finalMediaUrl = storedMediaUrl || directUrl

		// Update interview with media URL and transcription status
		await supabase
			.from("interviews")
			.update({
				media_url: finalMediaUrl,
				status: "transcribed",
				transcript: transcriptData.full_transcript,
				duration_sec: transcriptData.audio_duration ? Math.round(transcriptData.audio_duration) : null,
			})
			.eq("id", interview.id)

		// 2. metadata to pass to BAML pipeline
		const metadata = {
			accountId,
			projectId,
			userId: userId ?? undefined,
			interviewTitle: `Interview - ${format(new Date(), "MM/dd")}`,
			participantName: "TBD",
			segment: "TBD",
		}

		const userCustomInstructions = (formData.get("userCustomInstructions") as string) || ""

		// 3. Process transcript with BAML pipeline
		const result = await processInterviewTranscript({
			metadata,
			mediaUrl: finalMediaUrl,
			transcriptData,
			userCustomInstructions,
			request,
		})

		return Response.json({ success: true, insights: result.stored, interviewId: result.interview.id })
	} catch (error) {
		consola.error("upload-from-url error", error)
		return Response.json({ error: (error as Error).message || "Unknown error" }, { status: 500 })
	}
}
