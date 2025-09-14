import type { UUID } from "node:crypto"
import consola from "consola"
import { format } from "date-fns"
import type { ActionFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import { transcribeAudioFromUrl } from "~/utils/assemblyai.server"
import { processInterviewTranscript } from "~/utils/processInterview.server"
import { storeAudioFile } from "~/utils/storeAudioFile.server"

// Remix action to handle multipart/form-data file uploads, stream the file to
// AssemblyAI's /upload endpoint, then run the existing transcript->insights pipeline.
export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = ctx.account_id

	const formData = await request.formData()
	const file = formData.get("file") as File | null
	if (!file) {
		return Response.json({ error: "No file uploaded" }, { status: 400 })
	}
	// const body = formData.get("body") as string | null
	const projectId = formData.get("projectId") as UUID
	consola.log(`api.upload-file accountId: ${accountId}, projectId: ${projectId}`)

	if (!accountId || !projectId) {
		return Response.json({ error: "No accountId or projectId provided" }, { status: 400 })
	}

	try {
		// Check if file is text/markdown - handle directly without AssemblyAI
		const isTextFile =
			file.type.startsWith("text/") ||
			file.name.endsWith(".txt") ||
			file.name.endsWith(".md") ||
			file.name.endsWith(".markdown")

		let transcriptData: Record<string, unknown>
		let mediaUrl: string

		if (isTextFile) {
			// Handle text/markdown files - read content directly
			consola.log("Processing text/markdown file:", file.name)
			const textContent = await file.text()

			if (!textContent || textContent.trim().length === 0) {
				return Response.json({ error: "Text file is empty or could not be read" }, { status: 400 })
			}

			// Create transcript data object matching expected format
			transcriptData = {
				full_transcript: textContent.trim(),
				audio_duration: null, // No audio duration for text files
				file_type: "text",
				original_filename: file.name,
			}
			mediaUrl = "" // No media URL for text files

			consola.log(
				"Text file processed:",
				`${textContent.length} characters\n${textContent.slice(0, 500)}${textContent.length > 500 ? "..." : ""}`
			)
		} else {
			// Handle audio/video files - store file and transcribe
			
			// First create interview record to get ID for storage
			const { data: interview, error: insertError } = await supabase
				.from("interviews")
				.insert({
					account_id: accountId,
					project_id: projectId,
					title: `Interview - ${format(new Date(), "yyyy-MM-dd")}`,
					status: "uploading",
					original_filename: file.name,
				})
				.select()
				.single()

			if (insertError || !interview) {
				return Response.json({ error: "Failed to create interview record" }, { status: 500 })
			}

			// Store audio file in Supabase Storage
			consola.log("Storing audio file in Supabase Storage...")
			const { mediaUrl: storedMediaUrl, error: storageError } = await storeAudioFile(
				supabase,
				projectId,
				interview.id,
				file,
				file.name
			)

			if (storageError || !storedMediaUrl) {
				return Response.json({ error: `Failed to store audio file: ${storageError}` }, { status: 500 })
			}

			mediaUrl = storedMediaUrl

			// Upload to AssemblyAI for transcription
			const apiKey = process.env.ASSEMBLYAI_API_KEY
			if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY env var not set")

			const uploadResp = await fetch("https://api.assemblyai.com/v2/upload", {
				method: "POST",
				headers: { Authorization: apiKey },
				body: file.stream(), // pass-through readable stream from the browser upload
				duplex: "half",
			} as any)

			if (!uploadResp.ok) {
				const t = await uploadResp.text()
				throw new Error(`AssemblyAI upload failed: ${uploadResp.status} ${t}`)
			}

			const { upload_url } = (await uploadResp.json()) as { upload_url: string }

			// Transcribe using AssemblyAI URL (but keep our stored URL as mediaUrl)
			consola.log("Starting transcription for uploaded file")
			transcriptData = await transcribeAudioFromUrl(upload_url)
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
			await supabase
				.from("interviews")
				.update({ media_url: mediaUrl, status: "transcribed" })
				.eq("id", interview.id)
		}

		const metadata = {
			accountId,
			projectId,
			fileName: file?.name,
			interviewTitle: isTextFile
				? `Text Interview - ${format(new Date(), "yyyy-MM-dd")}`
				: `Interview - ${format(new Date(), "yyyy-MM-dd")}`,
			participantName: "Anonymous",
			segment: "Unknown",
		}

		const userCustomInstructions = (formData.get("userCustomInstructions") as string) || ""

		// 3. Run insight extraction + store in Supabase
		const result = await processInterviewTranscript({
			metadata,
			transcriptData,
			mediaUrl,
			userCustomInstructions,
			request,
		})

		return Response.json({ success: true, insights: result.stored, interviewId: result.interview.id })
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}
