import { openai } from "@ai-sdk/openai"
import { NoOutputGeneratedError, experimental_transcribe as transcribe } from "ai"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}

	// Auth + DB client for actions
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}

	// Accept either raw audio body or multipart form-data with a file
	const contentType = request.headers.get("content-type") || ""
	let audioData: Uint8Array | null = null

	try {
		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData()
			const fileCandidate =
				(formData.get("file") as File | null) ||
				(formData.get("audio") as File | null) ||
				(formData.get("blob") as File | null)

			if (!fileCandidate || !(fileCandidate instanceof File)) {
				return new Response("No file provided in form-data (expected field: file, audio, or blob)", {
					status: 400,
				})
			}

			const ab = await fileCandidate.arrayBuffer()
			audioData = new Uint8Array(ab)
		} else {
			// Raw body (e.g., fetch with Blob as body)
			const ab = await request.arrayBuffer()
			if (!ab || ab.byteLength === 0) {
				return new Response("Empty request body", { status: 400 })
			}
			audioData = new Uint8Array(ab)
		}

		// Transcribe via OpenAI Whisper. The AI SDK will auto-detect media type from bytes.
		const result = await transcribe({
			model: openai.transcription("gpt-4o-mini-transcribe"),
			// model: openai.transcription('whisper-1'),
			// model: assemblyai.transcription('nano'),
			audio: audioData,
			providerOptions: {
				openai: {
					language: "en", // Default to English transcription
				},
			},
			// Provide a reasonable timeout if desired; omit to let the provider handle longer files
			// abortSignal: AbortSignal.timeout(30_000),
		})

		// Return plain text so clients like the recorder can use response.text()
		return new Response(result.text ?? "", {
			status: 200,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		})
	} catch (error: any) {
		if (error instanceof NoOutputGeneratedError || error?.name === "AI_NoTranscriptGeneratedError") {
			consola.warn("No transcript generated", error?.responses)
			return new Response("", { status: 500 })
		}

		consola.error(error)
		return new Response("Failed to transcribe audio", { status: 500 })
	}
}
