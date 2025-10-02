import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/../supabase/types"

interface StoreAudioResult {
	mediaUrl: string | null
	error?: string
}

/**
 * Store audio file in Supabase Storage and return public URL
 */
export async function storeAudioFile(
	supabase: SupabaseClient<Database>,
	projectId: string,
	interviewId: string,
	source: File | Blob | string, // File, Blob, or URL
	originalFilename?: string
): Promise<StoreAudioResult> {
	try {
		const timestamp = Date.now()
		const extension = getFileExtension(source, originalFilename)
		const filename = `interviews/${projectId}/${interviewId}-${timestamp}.${extension}`

		let uploadData: File | Blob | ArrayBuffer

		if (typeof source === "string") {
			// Source is a URL - fetch the file
			consola.log("Fetching audio from URL:", source)

			try {
				// Handle potential redirects and SSL issues with AssemblyAI URLs
				const response = await fetch(source, {
					redirect: "follow",
					// Add headers to handle AssemblyAI redirects properly
					headers: {
						"User-Agent": "Insights-Audio-Fetcher/1.0",
					},
				})

				if (!response.ok) {
					return { mediaUrl: null, error: `Failed to fetch audio from URL: ${response.status}` }
				}

				uploadData = await response.blob()

				// Ensure we have actual content
				if (uploadData.size === 0) {
					return { mediaUrl: null, error: "Downloaded file is empty" }
				}

				consola.log("Successfully downloaded audio file, size:", uploadData.size)
			} catch (fetchError) {
				const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
				consola.error("Error fetching audio from URL:", errorMsg)
				return { mediaUrl: null, error: `Failed to download audio: ${errorMsg}` }
			}
		} else {
			// Source is already a File or Blob
			uploadData = source
		}

		consola.log("Uploading audio file to Storage:", filename)
		const { error: uploadError } = await supabase.storage
			.from("interview-recordings")
			.upload(filename, uploadData, { upsert: true })

		if (uploadError) {
			consola.error("Audio upload failed:", uploadError)
			return { mediaUrl: null, error: uploadError.message }
		}

		// Get public URL
		const { data } = supabase.storage.from("interview-recordings").getPublicUrl(filename)

		consola.log("Audio file stored successfully:", data.publicUrl)
		return { mediaUrl: data.publicUrl }
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		consola.error("Error storing audio file:", error)
		return { mediaUrl: null, error: message }
	}
}

/**
 * Determine file extension from source
 */
function getFileExtension(source: File | Blob | string, originalFilename?: string): string {
	if (typeof source === "string") {
		// URL source - try to extract extension from URL
		if (originalFilename) return getExtensionFromFilename(originalFilename)
		const url = new URL(source)
		const pathname = url.pathname
		const match = pathname.match(/\.([a-zA-Z0-9]+)$/)
		return match ? match[1] : "mp3" // default to mp3
	}

	if (source instanceof File) {
		// File source - use name
		return getExtensionFromFilename(source.name) || "mp3"
	}

	// Blob source - try to determine from type
	if (source instanceof Blob) {
		const type = source.type
		if (type.includes("webm")) return "webm"
		if (type.includes("mp4")) return "mp4"
		if (type.includes("wav")) return "wav"
		if (type.includes("mp3")) return "mp3"
		if (type.includes("m4a")) return "m4a"
		return "webm" // default for blobs (realtime recordings)
	}

	return "mp3" // fallback
}

function getExtensionFromFilename(filename: string): string | null {
	const match = filename.match(/\.([a-zA-Z0-9]+)$/)
	return match ? match[1] : null
}

// Helper to get file extension from File object
function getFileExtensionFromFile(file: File): string {
	return getExtensionFromFilename(file.name) || "unknown"
}
