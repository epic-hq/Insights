import { env } from "node:process"
import { AssemblyAI } from "assemblyai"
import consola from "consola"

import { safeSanitizeTranscriptPayload } from "~/utils/transcript/sanitizeTranscriptData.server"

// Initialize AssemblyAI client
function getAssemblyAIClient() {
	const apiKey = env.ASSEMBLYAI_API_KEY
	if (!apiKey) {
		throw new Error("ASSEMBLYAI_API_KEY not set in environment variables")
	}
	return new AssemblyAI({ apiKey })
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

	// Submit transcription with recommended parameters
	// Using slam-1 speech model for better accuracy
	const transcript = await client.transcripts.transcribe({
		audio: url,
		speech_model: "slam-1", // Latest high-accuracy speech model
		speaker_labels: true,
		iab_categories: true,
		format_text: true,
		punctuate: true,
		auto_chapters: true,
		sentiment_analysis: false,
	})

	// Check for errors
	if (transcript.status === "error") {
		throw new Error(`Transcription error: ${transcript.error}`)
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
	})

	return sanitized
}
