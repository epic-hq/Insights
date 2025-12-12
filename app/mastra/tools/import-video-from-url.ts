/**
 * Import Video from URL Tool (Mastra)
 *
 * This tool provides a chat-friendly interface to the importFromUrl Trigger.dev task.
 * It adds:
 * - Multiple asset detection with user choice flow
 * - Runtime context extraction for account/project/user IDs
 *
 * All actual media processing is delegated to the Trigger.dev task.
 */
import { createTool } from "@mastra/core/tools"
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import {
	type ExtractionResult,
	extractAllMediaUrls,
	isDirectMediaUrl,
	isStreamingUrl,
} from "~/utils/extractMediaUrl.server"
import type { importFromUrlTask } from "~/../src/trigger/interview/importFromUrl"

function ensureContext(runtimeContext?: Map<string, unknown> | any) {
	consola.info("[importVideoFromUrl] ensureContext called", {
		hasRuntimeContext: !!runtimeContext,
		runtimeContextType: typeof runtimeContext,
		hasGetMethod: typeof runtimeContext?.get === "function",
	})

	const accountId = runtimeContext?.get?.("account_id") as string | undefined
	const projectId = runtimeContext?.get?.("project_id") as string | undefined
	const userId = runtimeContext?.get?.("user_id") as string | undefined

	consola.info("[importVideoFromUrl] extracted context values", {
		accountId: accountId || "(empty)",
		projectId: projectId || "(empty)",
		userId: userId || "(empty)",
	})

	if (!accountId || !projectId) {
		consola.error("[importVideoFromUrl] Missing required context", { accountId, projectId })
		throw new Error(
			`Missing account_id or project_id in runtime context. Got accountId=${accountId}, projectId=${projectId}`
		)
	}

	return { accountId, projectId, userId }
}

export const importVideoFromUrlTool = createTool({
	id: "importVideoFromUrl",
	description: `Import a video/audio file from a URL. Supports:
- Direct media links (mp4, mp3, m4a, webm, mov, etc.)
- HLS streaming manifests (.m3u8) - automatically converted to MP4 via ffmpeg
- DASH streaming manifests (.mpd) - automatically converted to MP4 via ffmpeg
- Webpage URLs containing embedded video (Vento.so, Apollo.io, etc.) - automatically extracts media URL

The tool will scan webpages to find video/audio URLs, prioritizing HLS/DASH streams for best quality. For streaming formats, processing is handled via Trigger.dev with ffmpeg for reliable conversion.`,
	inputSchema: z.object({
		videoUrl: z
			.string()
			.url()
			.describe("URL to import - can be a direct media link or a webpage containing video/audio."),
		title: z.string().optional().describe("Optional title to use for the new interview."),
		participantName: z.string().optional().describe("Optional participant name to associate with the interview."),
		customInstructions: z.string().optional().describe("Optional custom instructions to guide analysis."),
	}),
	execute: async ({ context, runtimeContext }) => {
		const { videoUrl: inputUrl, title, participantName } = context
		const { accountId, projectId, userId } = ensureContext(runtimeContext)

		// Check if this is a webpage that might have multiple media assets
		// This provides a better UX by letting the user choose when there are options
		if (!isDirectMediaUrl(inputUrl) && !isStreamingUrl(inputUrl)) {
			consola.info(`[importVideoFromUrl] URL doesn't appear to be direct media, scanning page: ${inputUrl}`)
			const extractionResult = await extractAllMediaUrls(inputUrl)

			// If multiple distinct media types found, ask user to choose
			const uniqueTypes = new Set(extractionResult.assets.map((a) => a.type))
			if (extractionResult.assets.length > 1 && uniqueTypes.size > 1) {
				// Format options for user
				const options = extractionResult.assets.map((asset, i) => ({
					index: i + 1,
					type: asset.type,
					format: asset.format,
					url: asset.url.length > 80 ? asset.url.slice(0, 77) + "..." : asset.url,
				}))

				const videoCount = extractionResult.assets.filter((a) => a.type === "video").length
				const audioCount = extractionResult.assets.filter((a) => a.type === "audio").length
				const streamCount = extractionResult.assets.filter((a) => a.type === "stream").length

				return {
					success: false,
					needsUserChoice: true,
					message: `Found multiple media assets on this page. Please specify which one to import:\n\n` +
						`- **${streamCount} streaming video(s)** (HLS/DASH - highest quality)\n` +
						`- **${videoCount} video file(s)** (MP4, WebM, etc.)\n` +
						`- **${audioCount} audio file(s)** (MP3, M4A, etc.)\n\n` +
						`I recommend importing the **${extractionResult.recommended?.type}** (${extractionResult.recommended?.format}) for best quality. ` +
						`Should I proceed with that, or would you prefer a different option?`,
					availableAssets: options,
					recommendedAsset: extractionResult.recommended
						? {
							type: extractionResult.recommended.type,
							format: extractionResult.recommended.format,
							url: extractionResult.recommended.url,
						}
						: null,
					interviewId: null,
					triggerRunId: null,
					publicRunToken: null,
				}
			}

			// If no media found at all, return early with a helpful message
			if (!extractionResult.recommended) {
				return {
					success: false,
					message: `Could not find a video/audio file at ${inputUrl}. Please provide a direct link to the media file.`,
					interviewId: null,
					triggerRunId: null,
					publicRunToken: null,
				}
			}
			// Otherwise, proceed - the Trigger.dev task will handle the extraction
		}

		// Delegate all processing to the Trigger.dev task
		// The task handles: direct media URLs, HLS/DASH streams, and webpage extraction
		consola.info(`[importVideoFromUrl] Delegating to Trigger.dev task for URL: ${inputUrl}`)

		try {
			const handle = await tasks.trigger<typeof importFromUrlTask>("interview.import-from-url", {
				urls: [
					{
						url: inputUrl, // Use original URL so the task can detect provider/extract media
						title: title || undefined,
						speakerNames: participantName ? [participantName] : undefined,
					},
				],
				projectId,
				accountId,
				userId: userId || null,
			})

			return {
				success: true,
				message: "Import queued via Trigger.dev. The media will be downloaded, processed, and transcribed. This may take a few minutes.",
				interviewId: null, // Will be created by the Trigger.dev task
				triggerRunId: handle.id,
				publicRunToken: handle.publicAccessToken ?? null,
			}
		} catch (triggerError) {
			consola.error("[importVideoFromUrl] Failed to trigger import task:", triggerError)
			return {
				success: false,
				message: `Failed to queue media import: ${triggerError instanceof Error ? triggerError.message : "Unknown error"}`,
				interviewId: null,
				triggerRunId: null,
				publicRunToken: null,
			}
		}
	},
})
