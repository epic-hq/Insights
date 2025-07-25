import { env } from "node:process"
import consola from "consola"

const ASSEMBLY_API_URL = "https://api.assemblyai.com/v2"

// Upload a remote file to AssemblyAI then transcribe
export async function transcribeRemoteFile(url: string): Promise<Record<string, any>> {
	const apiKey = process.env.ASSEMBLYAI_API_KEY
	if (!apiKey) throw new Error("ASSEMBLYAI_API_KEY env var not set")

	// 1. Fetch the remote bytes (stream)
	const remoteResp = await fetch(url)
	if (!remoteResp.ok || !remoteResp.body) {
		throw new Error(`Failed to download file for upload: ${remoteResp.status}`)
	}

	// 2. Stream upload to AssemblyAI /upload
	const uploadResp = await fetch(`${ASSEMBLY_API_URL}/upload`, {
		method: "POST",
		headers: { Authorization: apiKey },
		body: remoteResp.body, // pass-through stream
		// Node.js (undici) requires duplex when the body is a stream
		// Cast to any to satisfy TypeScript until lib definitions include it
		duplex: "half",
	} as any)
	if (!uploadResp.ok) {
		const text = await uploadResp.text()
		throw new Error(`AssemblyAI upload failed: ${uploadResp.status} ${text}`)
	}
	const { upload_url } = (await uploadResp.json()) as { upload_url: string }

	// 3. Start transcript with the upload_url
	return await transcribeAudioFromUrl(upload_url)
}

// Keep the original public-URL transcription helper
export async function transcribeAudioFromUrl(url: string): Promise<Record<string, any>> {
	const apiKey = env.ASSEMBLYAI_API_KEY
	if (!apiKey) {
		throw new Error("ASSEMBLYAI_API_KEY not set in environment variables")
	}
	// 1. Submit new transcription job
	const createResp = await fetch(`${ASSEMBLY_API_URL}/transcript`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: apiKey,
		},
		body: JSON.stringify({
			audio_url: url,
			// additional recommended params
			speaker_labels: true,
			iab_categories: true,
			format_text: true,
			punctuate: true,
			auto_chapters: true,
			sentiment_analysis: false,
		}),
	})
	if (!createResp.ok) {
		const t = await createResp.text()
		throw new Error(`AssemblyAI create transcript failed: ${createResp.status} ${t}`)
	}
	const { id } = (await createResp.json()) as { id: string }

	// 2. Poll until completion
	let attempts = 0
	while (attempts < 60) {
		await new Promise((r) => setTimeout(r, 5000)) // 5s interval
		const statusResp = await fetch(`${ASSEMBLY_API_URL}/transcript/${id}`, {
			headers: {
				Authorization: apiKey,
			},
		})
		if (!statusResp.ok) {
			const t = await statusResp.text()
			throw new Error(`AssemblyAI status check failed: ${statusResp.status} ${t}`)
		}
		const data = (await statusResp.json()) as any
		if (data.status === "completed") {
			// consola.log("AssemblyAI transcription completed")
			const transcriptionData = {
				assembly_id: data.id,
				full_transcript: data.text || "",
				speaker_transcripts: data.utterances || [],
				sentiment_analysis: data.sentiment_analysis_results || [],
				topic_detection: data.iab_categories_result || {},
				language_code: data.language_code,
				confidence: data.confidence,
				audio_duration: data.audio_duration,
				word_count: data.words?.length || 0,
				speaker_count: data.utterances ? new Set(data.utterances.map((u) => u.speaker)).size : 0,
				is_processed: true, // Mark as successfully processed
				processed_at: new Date().toISOString(), // Set processing timestamp
			}
			consola.log("AssemblyAI transcription completed", transcriptionData)
			return transcriptionData
		}
		if (data.status === "error") {
			throw new Error(`AssemblyAI transcription error: ${data.error}`)
		}
		attempts++
	}
	throw new Error("AssemblyAI transcription timed out")
}
