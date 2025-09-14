import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
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
	const supabase = ctx.supabase

	try {
		const formData = await request.formData()
		const accountId = formData.get("accountId") as UUID
		const projectId = formData.get("projectId") as UUID
		const url = formData.get("url") as string
		consola.log("url", url)
		if (!url || !accountId || !projectId) {
			return Response.json({ error: "URL, accountId, and projectId are required" }, { status: 400 })
		}
		const directUrl = toDirectDownloadUrl(url)

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

		// Store audio file from URL in Supabase Storage
		consola.log("Storing audio file from URL in Supabase Storage...")
		const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile(
			supabase,
			projectId,
			interview.id,
			directUrl // URL source
		)

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
				duration_sec: transcriptData.audio_duration ? Math.round(transcriptData.audio_duration) : null
			})
			.eq("id", interview.id)

		// 2. metadata to pass to BAML pipeline
		const metadata = {
			accountId,
			projectId,
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
