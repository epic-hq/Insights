import consola from "consola"

import { createR2PresignedUrl, uploadToR2 } from "~/utils/r2.server"

interface StoreConversationAudioParams {
	analysisId: string
	source: File | Blob | string
	originalFilename?: string
	contentType?: string
}

interface StoreConversationAudioResult {
	mediaUrl: string | null
	error?: string
}

const MIME_EXTENSION_MAP: Record<string, string> = {
	"audio/mpeg": "mp3",
	"audio/mp3": "mp3",
	"audio/wav": "wav",
	"audio/x-wav": "wav",
	"audio/webm": "webm",
	"audio/ogg": "ogg",
	"audio/mp4": "m4a",
	"video/mp4": "mp4",
}

/**
 * Stores ad-hoc conversation recordings in the same R2 bucket we use for interviews, but
 * under a dedicated prefix so we can manage retention independently.
 */
export async function storeConversationAudio({
	analysisId,
	source,
	originalFilename,
	contentType,
}: StoreConversationAudioParams): Promise<StoreConversationAudioResult> {
	try {
		const resolved = await resolveSourceBlob(source, originalFilename, contentType)
		if (resolved.error) {
			return { mediaUrl: null, error: resolved.error }
		}

		const { blob, detectedContentType, inferredFilename } = resolved
		const extension = inferExtension({
			blob,
			originalFilename: originalFilename ?? inferredFilename,
			providedContentType: contentType ?? detectedContentType,
		})

		const filename = buildStorageKey({ analysisId, extension })
		const payload = new Uint8Array(await blob.arrayBuffer())
		if (!payload.length) {
			return { mediaUrl: null, error: "Audio file is empty" }
		}

		const mimeType = contentType || detectedContentType || inferMimeType(extension) || "application/octet-stream"

		consola.log("Uploading conversation audio to R2:", filename)
		const uploadResult = await uploadToR2({ key: filename, body: payload, contentType: mimeType })

		if (!uploadResult.success) {
			consola.error("Conversation audio upload failed:", uploadResult.error)
			return { mediaUrl: null, error: uploadResult.error ?? "Failed to upload conversation audio" }
		}

		const presigned = createR2PresignedUrl({ key: filename, expiresInSeconds: 24 * 60 * 60 })
		if (!presigned) {
			consola.error("Failed to create presigned URL for conversation audio")
			return { mediaUrl: null, error: "Unable to generate presigned URL" }
		}

		return { mediaUrl: presigned.url }
	} catch (error) {
		consola.error("Error storing conversation audio:", error)
		const message = error instanceof Error ? error.message : "Unknown error"
		return { mediaUrl: null, error: message }
	}
}

async function resolveSourceBlob(
	source: File | Blob | string,
	originalFilename?: string,
	providedContentType?: string
): Promise<
	| { blob: Blob; detectedContentType?: string; inferredFilename?: string; error?: undefined }
	| { error: string; blob?: undefined; detectedContentType?: undefined; inferredFilename?: undefined }
> {
	if (typeof source === "string") {
		try {
			consola.log("Fetching conversation audio from URL:", source)
			const response = await fetch(source)
			if (!response.ok) {
				return { error: `Failed to download audio: ${response.status}` }
			}

			const blob = await response.blob()
			if (blob.size === 0) {
				return { error: "Downloaded audio is empty" }
			}

			return {
				blob,
				detectedContentType: providedContentType || response.headers.get("content-type") || blob.type || undefined,
				inferredFilename: originalFilename ?? inferFilenameFromUrl(source),
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			return { error: `Unable to fetch audio: ${message}` }
		}
	}

	if (source instanceof Blob) {
		if (source.size === 0) {
			return { error: "Audio file is empty" }
		}

		return {
			blob: source,
			detectedContentType: providedContentType || source.type || undefined,
			inferredFilename: originalFilename ?? (source instanceof File ? source.name : undefined),
		}
	}

	return { error: "Unsupported audio source" }
}

function inferExtension({
	blob,
	originalFilename,
	providedContentType,
}: {
	blob: Blob
	originalFilename?: string
	providedContentType?: string
}) {
	const fromName = originalFilename?.split(".").pop()?.toLowerCase()
	if (fromName) return fromName

	const fromMime = providedContentType ? MIME_EXTENSION_MAP[providedContentType] : undefined
	if (fromMime) return fromMime

	const blobType = blob.type && MIME_EXTENSION_MAP[blob.type]
	return blobType || "bin"
}

function inferMimeType(extension: string) {
	const entry = Object.entries(MIME_EXTENSION_MAP).find(([, ext]) => ext === extension.toLowerCase())
	return entry ? entry[0] : undefined
}

function buildStorageKey({ analysisId, extension }: { analysisId: string; extension: string }) {
	const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"
	const timestamp = Date.now()
	return `conversation-analyses/${analysisId}/${analysisId}-${timestamp}.${safeExtension}`
}

function inferFilenameFromUrl(url: string) {
	try {
		const parsed = new URL(url)
		return parsed.pathname.split("/").pop() || undefined
	} catch (_error) {
		return undefined
	}
}
