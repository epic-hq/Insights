import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"
import { processInterviewTranscript } from "~/utils/processInterview.server"

// Remix action to handle multipart/form-data file uploads, stream the file to
// AssemblyAI's /upload endpoint, then run the existing transcript->insights pipeline.
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const formData = await request.formData()
	const file = formData.get("file") as File | null
	if (!file) {
		return Response.json({ error: "No file uploaded" }, { status: 400 })
	}
	// const body = formData.get("body") as string | null
	const accountId = formData.get("accountId") as UUID
	const projectId = formData.get("projectId") as UUID
	consola.log("formdata ", formData, accountId, projectId)

	if (!accountId || !projectId) {
		return Response.json({ error: "No accountId or projectId provided" }, { status: 400 })
	}

	try {
		// 1. Upload raw bytes to AssemblyAI
		const apiKey = process.env.ASSEMBLYAI_API_KEY
		if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY env var not set")

		const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
			method: "POST",
			headers: { Authorization: apiKey },
			body: file.stream(), // pass-through readable stream from the browser upload
			// @ts-expect-error  Node fetch (undici) needs duplex when body is a stream
			duplex: "half",
		} as any)

		if (!uploadResp.ok) {
			const t = await uploadResp.text()
			throw new Error(`AssemblyAI upload failed: ${uploadResp.status} ${t}`)
		}

		const { upload_url } = (await uploadResp.json()) as { upload_url: string }

		// 2. Transcribe the uploaded media
		consola.log("Starting transcription for uploaded file")
		const transcriptData = await transcribeAudioFromUrl(upload_url)
		consola.log(
			"Transcription result:",
			transcriptData
				? `${transcriptData.full_transcript.length} characters\n${transcriptData.full_transcript.slice(0, 500)}`
				: "null/empty"
		)

		if (!transcriptData || transcriptData.full_transcript.trim().length === 0) {
			return Response.json({ error: "Transcription failed or returned empty result" }, { status: 400 })
		}

		const metadata = {
			accountId,
			projectId,
			fileName: file?.name,
			interviewTitle: `Interview - ${format(new Date(), "yyyy-MM-dd")}`,
			participantName: "Anonymous",
			segment: "Unknown",
		}

		const userCustomInstructions = (formData.get("userCustomInstructions") as string) || ""

		// 3. Run insight extraction + store in Supabase
		const result = await processInterviewTranscript({
			metadata,
			transcriptData,
			mediaUrl: upload_url,
			userCustomInstructions,
			request,
		})

		return Response.json({ success: true, insights: result.stored })
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
