import consola from "consola"
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
	const body = await request.json()
	const orgId = body.orgId || ""
	const projectId = body.projectId || ""
	if (!orgId || !projectId) {
		return Response.json({ error: "No orgId or projectId provided" }, { status: 400 })
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
		const transcript = await transcribeAudioFromUrl(upload_url)
		consola.log("Transcript: ", transcript)

		const metadata = {
			orgId,
			projectId,
			interviewTitle: `Interview - ${new Date().toISOString()}`,
			participantName: "Anonymous",
			segment: "Unknown",
		}

		// 3. Run insight extraction + store in Supabase
		const result = await processInterviewTranscript(metadata, transcript)

		return Response.json({ success: true, insights: result.stored })
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
