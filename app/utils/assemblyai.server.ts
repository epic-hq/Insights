import { env } from "node:process"
import { AssemblyAI } from "assemblyai"
import consola from "consola"

import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

const MAX_ASSEMBLYAI_ATTEMPTS = 5
const INITIAL_BACKOFF_DELAY_MS = 2_000
const BACKOFF_FACTOR = 2
const RETRYABLE_MESSAGE_PATTERNS = [
	/server/i,
	/timeout/i,
	/unavailable/i,
	/try again later/i,
	/temporarily/i,
	/503/,
	/502/,
	/504/,
	/429/,
	/rate limit/i,
]

// Initialize AssemblyAI client
function getAssemblyAIClient() {
	const apiKey = env.ASSEMBLYAI_API_KEY
	if (!apiKey) {
		throw new Error("ASSEMBLYAI_API_KEY not set in environment variables")
	}
	return new AssemblyAI({ apiKey })
}

function extractMessage(error: unknown) {
	if (!error) return ""
	if (typeof error === "string") return error
	if (error instanceof Error) return error.message
	if (typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
		return (error as any).message
	}
	if (typeof error === "object" && "error" in error && typeof (error as any).error === "string") {
		return (error as any).error
	}
	return String(error)
}

function shouldRetryAssemblyError(error: unknown) {
	const status = typeof (error as any)?.status === "number" ? (error as any).status : (error as any)?.response?.status
	if (typeof status === "number" && (status >= 500 || status === 429)) {
		return true
	}

	const message = extractMessage(error)
	if (!message) return false

	return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
}

async function sleep(delayInMs: number) {
	await new Promise((resolve) => setTimeout(resolve, delayInMs))
}

// Transcribe a file from R2 storage
// Note: Files are already on Cloudflare R2, no need to upload to AssemblyAI
// Just pass the R2 URL directly to the transcription API
export async function transcribeRemoteFile(url: string): Promise<Record<string, any>> {
	// R2 URLs are already accessible, pass directly to AssemblyAI
	return await transcribeAudioFromUrl(url)
}

// Transcribe audio from a public URL using AssemblyAI SDK
export async function transcribeAudioFromUrl(url: string): Promise<Record<string, any>> {
	const client = getAssemblyAIClient()

	let attempt = 0
	let lastError: unknown

	while (attempt < MAX_ASSEMBLYAI_ATTEMPTS) {
		attempt += 1
		try {
			// Submit transcription with recommended parameters
			// Using slam-1 speech model for better accuracy
			const transcript = await client.transcripts.transcribe({
				audio: url,
				speech_model: "slam-1", // Latest high-accuracy speech model
				language_code: "en", // Default to English transcription
				speaker_labels: true,
				// iab_categories: true,
				format_text: true,
				punctuate: true,
				// auto_chapters: true,
				sentiment_analysis: false,
			})

			// Check for errors
			if (transcript.status === "error") {
				const message = transcript.error ?? "Unknown AssemblyAI error"
				lastError = new Error(`Transcription error: ${message}`)

				if (attempt < MAX_ASSEMBLYAI_ATTEMPTS && shouldRetryAssemblyError(message)) {
					const delay = INITIAL_BACKOFF_DELAY_MS * BACKOFF_FACTOR ** (attempt - 1)
					consola.warn(
						`AssemblyAI transcription attempt ${attempt} failed with API error (${message}). Retrying in ${delay}ms.`
					)
					await sleep(delay)
					continue
				}

				throw lastError
			}

			// Sanitize and format the response
			const sanitized = safeSanitizeTranscriptPayload({
				assembly_id: transcript.id,
				full_transcript: transcript.text || "",
				speaker_transcripts: transcript.utterances || [],
				sentiment_analysis_results: transcript.sentiment_analysis_results || [],
				topic_detection: transcript.iab_categories_result || {},
				language_code: transcript.language_code,
				confidence: transcript.confidence,
				audio_duration: transcript.audio_duration,
				word_count: transcript.words?.length || 0,
				speaker_count: transcript.utterances ? new Set(transcript.utterances.map((u) => u.speaker)).size : 0,
				is_processed: true,
				processed_at: new Date().toISOString(),
				auto_chapters: transcript.chapters || [],
				original_filename: url,
			})

			consola.log("Transcription completed", {
				audio_duration: sanitized.audio_duration,
				word_count: sanitized.word_count,
				speaker_segments: sanitized.speaker_transcripts.length,
				topic_results: sanitized.topic_detection?.results?.length ?? 0,
				attempt,
			})

			return sanitized
		} catch (error) {
			lastError = error

			if (attempt >= MAX_ASSEMBLYAI_ATTEMPTS || !shouldRetryAssemblyError(error)) {
				break
			}

			const delay = INITIAL_BACKOFF_DELAY_MS * BACKOFF_FACTOR ** (attempt - 1)
			consola.warn(
				`AssemblyAI transcription attempt ${attempt} failed (${extractMessage(error)}). Retrying in ${delay}ms.`
			)
			await sleep(delay)
		}
	}

	const message = extractMessage(lastError) || "Unknown AssemblyAI error"
	throw lastError instanceof Error ? lastError : new Error(message)
}
