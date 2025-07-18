import consola from "consola"
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
		const { url } = (await request.json()) as { url?: string }
		if (!url) {
			return Response.json({ error: "No URL provided" }, { status: 400 })
		}
		const directUrl = toDirectDownloadUrl(url)

		// 1. Upload then transcribe via AssemblyAI
		const transcript = await transcribeRemoteFile(directUrl)

		// 2. Mock metadata (replace later with real user/org info)
		const metadata = {
			orgId: "00000000-0000-0000-0000-000000000001",
			projectId: "00000000-0000-0000-0000-000000000002",
			interviewTitle: `Interview - ${new Date().toISOString()}`,
			participantName: "Anonymous",
			segment: "Unknown",
		}

		// 3. Process transcript with BAML pipeline
		const result = await processInterviewTranscript(metadata, transcript)

		return Response.json({ success: true, insights: result.stored })
	} catch (error) {
		consola.error("upload-from-url error", error)
		return Response.json({ error: (error as Error).message || "Unknown error" }, { status: 500 })
	}
}
