/**
 * Generate video thumbnail task
 *
 * Extracts a single frame from a video file and uploads it as a thumbnail.
 * Uses ffmpeg with HTTP streaming - only downloads the bytes needed for the frame,
 * not the entire video file. This makes it efficient for large files (1GB+).
 */

import { randomUUID } from "node:crypto"
import { createReadStream, statSync } from "node:fs"
import { unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { schemaTask } from "@trigger.dev/sdk"
import { execa } from "execa"
import ffmpeg from "ffmpeg-static"
import { z } from "zod"

// S3 client created lazily inside task to avoid env var errors at import time
function getS3Client() {
	const accessKeyId = process.env.R2_ACCESS_KEY_ID
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
	if (!accessKeyId || !secretAccessKey) {
		throw new Error("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY must be configured")
	}
	return new S3Client({
		region: process.env.R2_REGION ?? "auto",
		endpoint: process.env.R2_S3_ENDPOINT || process.env.R2_ENDPOINT,
		credentials: { accessKeyId, secretAccessKey },
	})
}

// Generate a presigned URL for reading a file from R2
async function makeSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
	const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME
	if (!bucket) {
		throw new Error("R2_BUCKET or R2_BUCKET_NAME must be configured")
	}

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	})

	return getSignedUrl(getS3Client(), command, { expiresIn: expiresInSeconds })
}

const GenerateThumbnailPayload = z.object({
	/** R2 key for the media file (e.g., "originals/abc123.mp4") */
	mediaKey: z.string(),
	/** Interview ID to update with thumbnail URL */
	interviewId: z.string().uuid(),
	/** Timestamp in seconds to capture frame from (default: 1) */
	timestampSec: z.number().optional().default(1),
	/** Account ID for metadata */
	accountId: z.string().uuid().optional(),
})

export const generateThumbnail = schemaTask({
	id: "generate-thumbnail",
	schema: GenerateThumbnailPayload,
	retry: {
		maxAttempts: 3,
		factor: 2,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 30000,
	},
	run: async (payload) => {
		const { mediaKey, interviewId, timestampSec = 1, accountId } = payload

		if (!ffmpeg) {
			throw new Error("ffmpeg binary not found")
		}

		// Generate signed URL for reading the source video
		// ffmpeg will stream directly from this URL - no need to download the whole file
		const signedSourceUrl = await makeSignedReadUrl(mediaKey, 3600) // 1 hour TTL

		// First, probe the file to check if it has video streams
		// Use ffmpeg to get stream info - if no video stream, skip thumbnail generation
		try {
			const probeResult = await execa(
				ffmpeg,
				["-hide_banner", "-i", signedSourceUrl, "-f", "null", "-"],
				{ timeout: 30000, reject: false }
			)
			// ffmpeg outputs stream info to stderr
			const probeOutput = probeResult.stderr || ""
			const hasVideoStream = /Stream.*Video:/i.test(probeOutput)

			if (!hasVideoStream) {
				console.log(`Skipping thumbnail for ${mediaKey} - no video stream (audio-only file)`)
				return {
					success: false,
					skipped: true,
					reason: "audio-only",
					interviewId,
					message: "File has no video stream - audio-only file",
				}
			}
		} catch (probeError) {
			console.warn("Failed to probe file, attempting thumbnail anyway:", probeError)
			// Continue anyway - the actual extraction will fail if there's no video
		}

		const outputPath = join(tmpdir(), `thumb-${randomUUID()}.jpg`)

		try {
			// Extract single frame using ffmpeg
			// -ss BEFORE -i enables fast seeking (only downloads bytes needed)
			// -vframes 1 captures just one frame
			// -q:v 2 sets JPEG quality (2 = high quality, smaller number = better)
			const ffmpegArgs = [
				"-hide_banner",
				"-y",
				"-ss",
				String(timestampSec),
				"-i",
				signedSourceUrl,
				"-vframes",
				"1",
				"-q:v",
				"2",
				// Scale to max 640px width while preserving aspect ratio
				"-vf",
				"scale=640:-1",
				outputPath,
			]

			console.log(`Extracting thumbnail from ${mediaKey} at ${timestampSec}s`)
			await execa(ffmpeg, ffmpegArgs, { timeout: 60000 }) // 60s timeout

			// Verify output file exists and has content
			const stats = statSync(outputPath)
			if (stats.size === 0) {
				throw new Error("Generated thumbnail is empty")
			}

			console.log(`Generated thumbnail: ${stats.size} bytes`)

			// Upload to R2
			const thumbnailKey = `thumbnails/${interviewId}.jpg`
			const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME
			if (!bucket) throw new Error("R2_BUCKET not configured")

			await getS3Client().send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: thumbnailKey,
					Body: createReadStream(outputPath),
					ContentType: "image/jpeg",
					Metadata: {
						interviewId,
						sourceKey: mediaKey,
						timestampSec: String(timestampSec),
						...(accountId && { accountId }),
					},
				})
			)

			console.log(`Uploaded thumbnail to ${thumbnailKey}`)

			// Update interview with thumbnail URL
			// Use the internal key format that will be signed on read
			const thumbnailUrl = thumbnailKey

			const supabaseUrl = process.env.SUPABASE_URL
			const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
			if (!supabaseUrl || !supabaseServiceKey) {
				throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")
			}

			const updateResponse = await fetch(`${supabaseUrl}/rest/v1/interviews?id=eq.${interviewId}`, {
				method: "PATCH",
				headers: {
					apikey: supabaseServiceKey,
					Authorization: `Bearer ${supabaseServiceKey}`,
					"Content-Type": "application/json",
					Prefer: "return=minimal",
				},
				body: JSON.stringify({ thumbnail_url: thumbnailUrl }),
			})

			if (!updateResponse.ok) {
				const errorText = await updateResponse.text()
				throw new Error(`Failed to update interview: ${updateResponse.status} ${errorText}`)
			}

			console.log(`Updated interview ${interviewId} with thumbnail URL`)

			return {
				success: true,
				thumbnailKey,
				thumbnailUrl,
				interviewId,
				fileSizeBytes: stats.size,
			}
		} finally {
			// Clean up temp file
			await unlink(outputPath).catch(() => {
				// Ignore cleanup errors
			})
		}
	},
})
