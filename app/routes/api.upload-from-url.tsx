import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { transcribeRemoteFile } from "~/utils/assemblyai.server"
import { processInterviewTranscript } from "~/utils/processInterview.server"

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

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}
	try {
		const formData = await request.formData()
		const accountId = formData.get("accountId") as UUID
		const projectId = formData.get("projectId") as UUID
		const url = formData.get("url") as string
		consola.log("url", url)
		if (!url) {
			return Response.json({ error: "No URL provided" }, { status: 400 })
		}
		const directUrl = toDirectDownloadUrl(url)

		// 1. Upload then transcribe via AssemblyAI
		consola.log("Starting transcription for URL:", directUrl)
		const transcriptData = await transcribeRemoteFile(directUrl)
		consola.log("Transcription result:", transcriptData ? `${transcriptData.length} characters` : "null/empty")

		if (!transcriptData || transcriptData.full_transcript.trim().length === 0) {
			return Response.json({ error: "Transcription failed or returned empty result" }, { status: 400 })
		}

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
			mediaUrl: url,
			transcriptData,
			userCustomInstructions,
			request,
		})

		return Response.json({ success: true, insights: result.stored })
	} catch (error) {
		consola.error("upload-from-url error", error)
		return Response.json({ error: (error as Error).message || "Unknown error" }, { status: 500 })
	}
}
