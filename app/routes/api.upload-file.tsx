import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"
import { processInterviewTranscript } from "~/utils/processInterview.server"
import { db } from "~/lib/supabase/server"

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

		// 3. Determine org & project (TODO: use session). For now static org and first project.
		const orgId = "00000000-0000-0000-0000-000000000001"
		let projectId: string | null = null
		const { data: projectRow, error: projErr } = await db
			.from("research_projects")
			.select("id")
			.eq("org_id", orgId)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle()
		if (projErr) throw new Error(`Failed fetching projects: ${projErr.message}`)

		if (projectRow?.id) {
			projectId = projectRow.id as string
		} else {
			// create temp project
			const slug = `temp_${Date.now()}`
			const { data: newProj, error: createErr } = await db
				.from("research_projects")
				.insert({
					org_id: orgId,
					code: slug,
					title: "Untitled Project",
					description: "Auto-created by upload flow",
				})
				.select("id")
				.single()
			if (createErr || !newProj) throw new Error(`Failed creating temp project: ${createErr?.message}`)
			projectId = newProj.id as string
		}

		const metadata = {
			orgId,
			projectId,

			interviewTitle: `Interview - ${new Date().toISOString()}`,
			participantName: "Anonymous",
			segment: "Unknown",
		}

		// 4. Run insight extraction + store in Supabase
		const result = await processInterviewTranscript(metadata, transcript)

		return Response.json({ success: true, insights: result.stored })
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
