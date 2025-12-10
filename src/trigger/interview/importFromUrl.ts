/**
 * Import Interview from URL Task
 *
 * Fetches media from external URLs (Vento.so, Apollo.io, etc.),
 * uploads to R2, and triggers the interview processing workflow.
 *
 * Supported providers:
 * - Vento.so: Screen recordings with HLS streams
 * - Apollo.io: Sales call recordings (requires API integration)
 */

import { schemaTask, task } from "@trigger.dev/sdk"
import consola from "consola"
import { spawn } from "node:child_process"
import { createReadStream, promises as fs, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { uploadToR2 } from "~/utils/r2.server"
import { processInterviewOrchestratorV2 } from "./v2/orchestrator"

// =============================================================================
// Types & Schemas
// =============================================================================

const UrlImportItemSchema = z.object({
	url: z.string().url(),
	title: z.string().optional(),
	speakerNames: z.array(z.string()).optional(), // e.g., ["Speaker A", "John Smith"]
})

const ImportFromUrlPayloadSchema = z.object({
	urls: z.array(UrlImportItemSchema).min(1),
	projectId: z.string().uuid(),
	accountId: z.string().uuid(),
	userId: z.string(),
})

export type ImportFromUrlPayload = z.infer<typeof ImportFromUrlPayloadSchema>

type Provider = "vento" | "apollo" | "unknown"

interface MediaInfo {
	provider: Provider
	title: string
	duration?: number
	videoUrl?: string // Direct video URL or HLS manifest
	audioUrl?: string // Direct audio URL
	thumbnailUrl?: string
	isHls: boolean
}

interface DownloadResult {
	success: boolean
	filePath?: string
	contentType?: string
	error?: string
}

// =============================================================================
// Provider Detection & Media Extraction
// =============================================================================

function detectProvider(url: string): Provider {
	const urlLower = url.toLowerCase()
	if (urlLower.includes("vento.so")) return "vento"
	if (urlLower.includes("apollo.io")) return "apollo"
	return "unknown"
}

/**
 * Extract recording ID from Vento URL
 * Format: https://vento.so/view/{uuid}
 */
function extractVentoId(url: string): string | null {
	const match = url.match(/vento\.so\/view\/([a-f0-9-]+)/i)
	return match?.[1] ?? null
}

/**
 * Extract share ID from Apollo URL
 * Format: https://app.apollo.io/#/conversation-shares/{id1}-{id2}
 */
function extractApolloId(url: string): string | null {
	const match = url.match(/conversation-shares\/([a-f0-9-]+)/i)
	return match?.[1] ?? null
}

/**
 * Fetch media info from Vento API
 */
async function fetchVentoMedia(recordingId: string): Promise<MediaInfo | null> {
	try {
		const response = await fetch(`https://vento.so/api/recording/${recordingId}`)
		if (!response.ok) {
			consola.error(`Vento API returned ${response.status} for ${recordingId}`)
			return null
		}

		const data = await response.json()

		// Vento returns video URL in format like:
		// https://storage.googleapis.com/vento-assets/{userId}/{recordingId}/v0/video-1080p_0.m3u8
		const videoUrl = data.videoUrl || data.video_url || data.url
		const audioUrl = data.audioUrl || data.audio_url
		const thumbnailUrl = data.thumbnailUrl || data.thumbnail_url

		return {
			provider: "vento",
			title: data.title || data.name || `Vento Recording ${recordingId.slice(0, 8)}`,
			duration: data.duration || data.durationSeconds,
			videoUrl,
			audioUrl,
			thumbnailUrl,
			isHls: videoUrl?.includes(".m3u8") ?? false,
		}
	} catch (error) {
		consola.error("Failed to fetch Vento media info:", error)
		return null
	}
}

/**
 * Fetch media info from Apollo API
 * Note: Apollo may require authentication for some endpoints
 */
async function fetchApolloMedia(shareId: string): Promise<MediaInfo | null> {
	try {
		// Try the public share API
		const response = await fetch(`https://app.apollo.io/api/v1/conversation_shares/${shareId}`)
		if (!response.ok) {
			consola.warn(`Apollo API returned ${response.status} for ${shareId}`)
			// Apollo often requires authentication or redirects
			return null
		}

		const data = await response.json()

		// Check if we need to follow a redirect
		if (data.message === "Redirect required" && data.type === "external") {
			consola.info("Apollo requires external redirect - may need manual handling")
			return null
		}

		return {
			provider: "apollo",
			title: data.title || data.name || `Apollo Recording ${shareId.slice(0, 8)}`,
			duration: data.duration,
			videoUrl: data.video_url || data.videoUrl,
			audioUrl: data.audio_url || data.audioUrl,
			isHls: data.video_url?.includes(".m3u8") ?? false,
		}
	} catch (error) {
		consola.error("Failed to fetch Apollo media info:", error)
		return null
	}
}

// =============================================================================
// Media Download
// =============================================================================

/**
 * Download HLS stream using ffmpeg and convert to MP4
 */
async function downloadHlsStream(hlsUrl: string, outputPath: string): Promise<DownloadResult> {
	return new Promise((resolve) => {
		consola.info(`Downloading HLS stream: ${hlsUrl}`)

		const ffmpeg = spawn("ffmpeg", [
			"-i",
			hlsUrl,
			"-c",
			"copy", // Copy without re-encoding (fastest)
			"-bsf:a",
			"aac_adtstoasc", // Fix AAC audio for MP4 container
			"-y", // Overwrite output
			outputPath,
		])

		let stderr = ""
		ffmpeg.stderr.on("data", (data) => {
			stderr += data.toString()
		})

		ffmpeg.on("close", (code) => {
			if (code === 0) {
				consola.success(`Downloaded HLS to ${outputPath}`)
				resolve({
					success: true,
					filePath: outputPath,
					contentType: "video/mp4",
				})
			} else {
				consola.error(`ffmpeg exited with code ${code}:`, stderr.slice(-500))
				resolve({
					success: false,
					error: `ffmpeg failed with code ${code}`,
				})
			}
		})

		ffmpeg.on("error", (err) => {
			consola.error("ffmpeg spawn error:", err)
			resolve({
				success: false,
				error: err.message,
			})
		})
	})
}

/**
 * Download direct media file
 */
async function downloadDirectMedia(url: string, outputPath: string): Promise<DownloadResult> {
	try {
		consola.info(`Downloading direct media: ${url}`)

		const response = await fetch(url, {
			headers: { "User-Agent": "Insights-Media-Fetcher/1.0" },
		})

		if (!response.ok) {
			return {
				success: false,
				error: `HTTP ${response.status}: ${response.statusText}`,
			}
		}

		const contentType = response.headers.get("content-type") || "application/octet-stream"
		const buffer = await response.arrayBuffer()

		await fs.writeFile(outputPath, Buffer.from(buffer))

		consola.success(`Downloaded to ${outputPath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)

		return {
			success: true,
			filePath: outputPath,
			contentType,
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Download failed",
		}
	}
}

// =============================================================================
// Main Task
// =============================================================================

export const importFromUrlTask = schemaTask({
	id: "interview.import-from-url",
	schema: ImportFromUrlPayloadSchema,
	retry: {
		maxAttempts: 3,
		factor: 2,
		minTimeoutInMs: 5000,
		maxTimeoutInMs: 60000,
	},
	run: async (payload) => {
		const { urls, projectId, accountId, userId } = payload
		const client = createSupabaseAdminClient()

		const results: Array<{
			url: string
			success: boolean
			interviewId?: string
			analysisJobId?: string
			error?: string
		}> = []

		for (const item of urls) {
			const { url, title: userTitle, speakerNames } = item

			try {
				consola.info(`\n📥 Processing URL: ${url}`)

				// 1. Detect provider and extract ID
				const provider = detectProvider(url)
				let mediaInfo: MediaInfo | null = null

				if (provider === "vento") {
					const ventoId = extractVentoId(url)
					if (!ventoId) {
						results.push({ url, success: false, error: "Could not extract Vento recording ID" })
						continue
					}
					mediaInfo = await fetchVentoMedia(ventoId)
				} else if (provider === "apollo") {
					const apolloId = extractApolloId(url)
					if (!apolloId) {
						results.push({ url, success: false, error: "Could not extract Apollo share ID" })
						continue
					}
					mediaInfo = await fetchApolloMedia(apolloId)

					if (!mediaInfo) {
						results.push({
							url,
							success: false,
							error: "Apollo recordings require authentication. Please download manually and upload.",
						})
						continue
					}
				} else {
					results.push({ url, success: false, error: `Unsupported URL provider: ${provider}` })
					continue
				}

				if (!mediaInfo || (!mediaInfo.videoUrl && !mediaInfo.audioUrl)) {
					results.push({ url, success: false, error: "Could not extract media URL from provider" })
					continue
				}

				// 2. Download media to temp file
				const tempDir = tmpdir()
				const timestamp = Date.now()
				const tempFile = join(tempDir, `import-${timestamp}.mp4`)

				let downloadResult: DownloadResult

				if (mediaInfo.isHls && mediaInfo.videoUrl) {
					downloadResult = await downloadHlsStream(mediaInfo.videoUrl, tempFile)
				} else if (mediaInfo.videoUrl) {
					downloadResult = await downloadDirectMedia(mediaInfo.videoUrl, tempFile)
				} else if (mediaInfo.audioUrl) {
					downloadResult = await downloadDirectMedia(mediaInfo.audioUrl, tempFile.replace(".mp4", ".mp3"))
				} else {
					results.push({ url, success: false, error: "No downloadable media URL found" })
					continue
				}

				if (!downloadResult.success || !downloadResult.filePath) {
					results.push({ url, success: false, error: downloadResult.error || "Download failed" })
					continue
				}

				// 3. Upload to R2
				const fileStats = statSync(downloadResult.filePath)
				const fileBuffer = await fs.readFile(downloadResult.filePath)
				const r2Key = `interviews/${projectId}/import-${timestamp}.mp4`

				consola.info(`Uploading to R2: ${r2Key} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`)

				const uploadResult = await uploadToR2({
					key: r2Key,
					body: new Uint8Array(fileBuffer),
					contentType: downloadResult.contentType || "video/mp4",
				})

				// Clean up temp file
				await fs.unlink(downloadResult.filePath).catch(() => {})

				if (!uploadResult.success) {
					results.push({ url, success: false, error: "Failed to upload to R2" })
					continue
				}

				// 4. Create analysis job
				const { data: analysisJob, error: jobError } = await client
					.from("analysis_jobs")
					.insert({
						project_id: projectId,
						account_id: accountId,
						status: "pending",
						source_url: url,
						created_by: userId,
					})
					.select()
					.single()

				if (jobError || !analysisJob) {
					results.push({ url, success: false, error: `Failed to create analysis job: ${jobError?.message}` })
					continue
				}

				// 5. Trigger the interview processing workflow
				const title = userTitle || mediaInfo.title || `Import from ${provider}`

				consola.info(`Triggering interview workflow for: ${title}`)

				const orchestratorResult = await processInterviewOrchestratorV2.triggerAndWait({
					metadata: {
						projectId,
						accountId,
						userId,
						interviewTitle: title,
						fileName: `${provider}-import-${timestamp}.mp4`,
						// Speaker names will be processed during interview creation
						// and stored in interview_people records after transcription
						participantName: speakerNames?.[0] || undefined,
					},
					mediaUrl: r2Key,
					transcriptData: { needs_transcription: true },
					analysisJobId: analysisJob.id,
				})

				if (orchestratorResult.ok) {
					consola.success(`✅ Import complete: ${title}`)
					results.push({
						url,
						success: true,
						interviewId: orchestratorResult.output.interviewId,
						analysisJobId: analysisJob.id,
					})
				} else {
					results.push({
						url,
						success: false,
						error: `Orchestrator failed: ${orchestratorResult.error}`,
						analysisJobId: analysisJob.id,
					})
				}
			} catch (error) {
				consola.error(`Error processing ${url}:`, error)
				results.push({
					url,
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
				})
			}
		}

		// Summary
		const successCount = results.filter((r) => r.success).length
		consola.info(`\n📊 Import Summary: ${successCount}/${urls.length} successful`)

		return {
			totalUrls: urls.length,
			successCount,
			failedCount: urls.length - successCount,
			results,
		}
	},
})

// =============================================================================
// Utility: Test URL extraction without processing
// =============================================================================

export const testUrlExtractionTask = task({
	id: "interview.test-url-extraction",
	run: async (payload: { urls: string[] }) => {
		const results: Array<{
			url: string
			provider: Provider
			mediaInfo: MediaInfo | null
		}> = []

		for (const url of payload.urls) {
			const provider = detectProvider(url)
			let mediaInfo: MediaInfo | null = null

			if (provider === "vento") {
				const ventoId = extractVentoId(url)
				if (ventoId) {
					mediaInfo = await fetchVentoMedia(ventoId)
				}
			} else if (provider === "apollo") {
				const apolloId = extractApolloId(url)
				if (apolloId) {
					mediaInfo = await fetchApolloMedia(apolloId)
				}
			}

			results.push({ url, provider, mediaInfo })
		}

		return { results }
	},
})
