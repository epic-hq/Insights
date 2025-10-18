import consola from "consola"
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse"
import { getR2PublicUrl, uploadToR2 } from "~/utils/r2.server"

interface StoreAudioResult {
	mediaUrl: string | null
	error?: string
}

interface StoreAudioFileParams {
	projectId: string
	interviewId: string
	source: File | Blob | string
	originalFilename?: string
	contentType?: string
	langfuseParent?: LangfuseTraceClient | LangfuseSpanClient
}

/**
 * Store audio file in Cloudflare R2 and return a public URL
 */
export async function storeAudioFile({
	projectId,
	interviewId,
	source,
	originalFilename,
	contentType,
	langfuseParent,
}: StoreAudioFileParams): Promise<StoreAudioResult> {
	const baseMetadata = {
		projectId,
		interviewId,
		originalFilename: originalFilename ?? null,
		sourceKind: typeof source === "string" ? "url" : isFile(source) ? "file" : "blob",
	}
	let uploadSpan: LangfuseSpanClient | undefined
	try {
		const timestamp = Date.now()

		const resolvedSource = await resolveSourceBlob(source, originalFilename, contentType)
		if (resolvedSource.error) {
			langfuseParent
				?.span?.({
					name: "storage.r2.resolve",
					metadata: {
						...baseMetadata,
						providedContentType: contentType ?? null,
					},
					input: {
						sourceKind: baseMetadata.sourceKind,
					},
				})
				?.end?.({
					level: "ERROR",
					statusMessage: resolvedSource.error,
				})
			return { mediaUrl: null, error: resolvedSource.error }
		}

		const { blob, detectedContentType, inferredFilename } = resolvedSource

		uploadSpan = langfuseParent?.span?.({
			name: "storage.r2.upload",
			metadata: {
				...baseMetadata,
				inferredFilename: inferredFilename ?? null,
				timestamp,
			},
			input: {
				sourceKind: baseMetadata.sourceKind,
				size: blob.size,
				providedContentType: contentType ?? null,
				detectedContentType: detectedContentType ?? null,
			},
		})

		const extension = getFileExtension(
			typeof source === "string" ? source : blob,
			originalFilename ?? inferredFilename,
			contentType ?? detectedContentType
		)
		const filename = `interviews/${projectId}/${interviewId}-${timestamp}.${extension}`

		const payload = await blobToUint8Array(blob)
		if (!payload.length) {
			uploadSpan?.end?.({
				level: "ERROR",
				statusMessage: "Audio file is empty",
			})
			return { mediaUrl: null, error: "Audio file is empty" }
		}

		const mimeType = contentType || detectedContentType || inferMimeType(extension) || "application/octet-stream"

		consola.log("Uploading audio file to Cloudflare R2:", filename)
		const uploadResult = await uploadToR2({ key: filename, body: payload, contentType: mimeType })

		if (!uploadResult.success) {
			consola.error("Audio upload to R2 failed:", uploadResult.error)
			uploadSpan?.end?.({
				level: "ERROR",
				statusMessage: uploadResult.error ?? "Failed to upload audio",
				metadata: {
					errorCode: uploadResult.error ?? null,
				},
			})
			return { mediaUrl: null, error: uploadResult.error ?? "Failed to upload audio" }
		}

		const publicUrl = getR2PublicUrl(filename)
		if (!publicUrl) {
			consola.error("R2 public base URL not configured; cannot resolve media URL")
			uploadSpan?.end?.({
				level: "ERROR",
				statusMessage: "Cloudflare R2 public URL is not configured",
			})
			return { mediaUrl: null, error: "Cloudflare R2 public URL is not configured" }
		}

		consola.log("Audio file stored successfully in R2:", publicUrl)
		uploadSpan?.end?.({
			output: {
				mediaUrl: publicUrl,
				bytesUploaded: payload.length,
				contentType: mimeType,
			},
		})
		return { mediaUrl: publicUrl }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Error storing audio file in R2:", error)
		uploadSpan?.end?.({
			level: "ERROR",
			statusMessage: message,
		})
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
		consola.log("Fetching audio from URL:", source)
		try {
			const response = await fetch(source, {
				redirect: "follow",
				headers: {
					"User-Agent": "Insights-Audio-Fetcher/1.0",
				},
			})

			if (!response.ok) {
				return { error: `Failed to fetch audio from URL: ${response.status}` }
			}

			const blob = await response.blob()
			if (blob.size === 0) {
				return { error: "Downloaded file is empty" }
			}

			const detectedContentType = providedContentType || response.headers.get("content-type") || blob.type || undefined

			return {
				blob,
				detectedContentType,
				inferredFilename: originalFilename ?? inferFilenameFromUrl(source),
			}
		} catch (fetchError) {
			const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
			consola.error("Error fetching audio from URL:", errorMsg)
			return { error: `Failed to download audio: ${errorMsg}` }
		}
	}

	if (isBlob(source)) {
		if (source.size === 0) {
			return { error: "Audio file is empty" }
		}

		const detectedContentType = providedContentType || source.type || undefined
		const inferredFilename = originalFilename ?? (isFile(source) ? source.name : undefined)

		return { blob: source, detectedContentType, inferredFilename }
	}

	return { error: "Unsupported audio source type" }
}

function isBlob(value: unknown): value is Blob {
	return typeof Blob !== "undefined" && value instanceof Blob
}

function isFile(value: Blob): value is File {
	return typeof File !== "undefined" && value instanceof File
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
	const arrayBuffer = await blob.arrayBuffer()
	return new Uint8Array(arrayBuffer)
}

function getFileExtension(source: File | Blob | string, originalFilename?: string, contentType?: string): string {
	if (originalFilename) {
		const fromName = getExtensionFromFilename(originalFilename)
		if (fromName) return fromName
	}

	if (typeof source === "string") {
		try {
			const url = new URL(source)
			const match = url.pathname.match(/\.([a-zA-Z0-9]+)(?:$|\?)/)
			if (match) return match[1]
		} catch {
			/* ignore invalid URLs */
		}

		const fromContentType = extensionFromContentType(contentType)
		if (fromContentType) return fromContentType

		return "mp3"
	}

	if (isFile(source)) {
		const fromName = getExtensionFromFilename(source.name)
		if (fromName) return fromName
	}

	if (contentType) {
		const fromContentType = extensionFromContentType(contentType)
		if (fromContentType) return fromContentType
	}

	if (source.type) {
		const fromType = extensionFromContentType(source.type)
		if (fromType) return fromType
	}

	return "webm"
}

function getExtensionFromFilename(filename: string): string | null {
	const match = filename.match(/\.([a-zA-Z0-9]+)$/)
	return match ? match[1] : null
}

function extensionFromContentType(contentType?: string | null): string | null {
	if (!contentType) return null
	const normalized = contentType.split(";")[0]?.trim().toLowerCase()
	return CONTENT_TYPE_TO_EXTENSION[normalized] ?? null
}

function inferMimeType(extension: string): string | undefined {
	return MIME_TYPES[extension.toLowerCase()]
}

function inferFilenameFromUrl(url: string): string | undefined {
	try {
		const parsed = new URL(url)
		const parts = parsed.pathname.split("/")
		const last = parts.pop()
		if (last && last.includes(".")) return last
	} catch {
		/* ignore */
	}
	return undefined
}

const MIME_TYPES: Record<string, string> = {
	webm: "audio/webm",
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	mp4: "video/mp4",
	mov: "video/quicktime",
	ogg: "audio/ogg",
	aac: "audio/aac",
	flac: "audio/flac",
}

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
	"audio/webm": "webm",
	"audio/wav": "wav",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"video/mp4": "mp4",
	"video/quicktime": "mov",
	"audio/ogg": "ogg",
	"audio/aac": "aac",
	"audio/flac": "flac",
}
