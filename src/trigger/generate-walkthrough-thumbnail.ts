/**
 * Generate walkthrough thumbnail task
 *
 * Extracts a single frame from a walkthrough video and uploads it as a thumbnail.
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

const GenerateWalkthroughThumbnailPayload = z.object({
	/** R2 key for the media file (e.g., "ask-walkthroughs/abc123/walkthrough.mp4") */
	mediaKey: z.string(),
	/** Research link ID to update with thumbnail URL */
	linkId: z.string().uuid(),
	/** Timestamp in seconds to capture frame from (default: 1) */
	timestampSec: z.number().optional().default(1),
	/** Account ID for metadata */
	accountId: z.string().uuid().optional(),
})

export const generateWalkthroughThumbnail = schemaTask({
	id: "generate-walkthrough-thumbnail",
	schema: GenerateWalkthroughThumbnailPayload,
	retry: {
		maxAttempts: 3,
		factor: 2,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 30000,
	},
	run: async (payload) => {
		const { mediaKey, linkId, timestampSec = 1, accountId } = payload

		if (!ffmpeg) {
			throw new Error("ffmpeg binary not found")
		}

		const signedSourceUrl = await makeSignedReadUrl(mediaKey, 3600)

		try {
			const probeResult = await execa(
				ffmpeg,
				["-hide_banner", "-i", signedSourceUrl, "-f", "null", "-"],
				{ timeout: 30000, reject: false }
			)
			const probeOutput = probeResult.stderr || ""
			const hasVideoStream = /Stream.*Video:/i.test(probeOutput)

			if (!hasVideoStream) {
				console.log(`Skipping thumbnail for ${mediaKey} - no video stream (audio-only file)`)
				return {
					success: false,
					skipped: true,
					reason: "audio-only",
					linkId,
					message: "File has no video stream - audio-only file",
				}
			}
		} catch (probeError) {
			console.warn("Failed to probe file, attempting thumbnail anyway:", probeError)
		}

		const outputPath = join(tmpdir(), `walkthrough-thumb-${randomUUID()}.jpg`)

		try {
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
				"-vf",
				"scale=640:-1",
				outputPath,
			]

			console.log(`Extracting walkthrough thumbnail from ${mediaKey} at ${timestampSec}s`)
			await execa(ffmpeg, ffmpegArgs, { timeout: 60000 })

			const stats = statSync(outputPath)
			if (stats.size === 0) {
				throw new Error("Generated thumbnail is empty")
			}

			const thumbnailKey = `thumbnails/research-links/${linkId}.jpg`
			const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME
			if (!bucket) throw new Error("R2_BUCKET not configured")

			await getS3Client().send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: thumbnailKey,
					Body: createReadStream(outputPath),
					ContentType: "image/jpeg",
					Metadata: {
						linkId,
						sourceKey: mediaKey,
						timestampSec: String(timestampSec),
						...(accountId && { accountId }),
					},
				})
			)

			const supabaseUrl = process.env.SUPABASE_URL
			const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
			if (!supabaseUrl || !supabaseServiceKey) {
				throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured")
			}

			const updateResponse = await fetch(`${supabaseUrl}/rest/v1/research_links?id=eq.${linkId}`, {
				method: "PATCH",
				headers: {
					apikey: supabaseServiceKey,
					Authorization: `Bearer ${supabaseServiceKey}`,
					"Content-Type": "application/json",
					Prefer: "return=minimal",
				},
				body: JSON.stringify({ walkthrough_thumbnail_url: thumbnailKey }),
			})

			if (!updateResponse.ok) {
				const errorText = await updateResponse.text()
				throw new Error(`Failed to update research link: ${updateResponse.status} ${errorText}`)
			}

			return {
				success: true,
				thumbnailKey,
				thumbnailUrl: thumbnailKey,
				linkId,
				fileSizeBytes: stats.size,
			}
		} finally {
			await unlink(outputPath).catch(() => {
				// Ignore cleanup errors
			})
		}
	},
})
