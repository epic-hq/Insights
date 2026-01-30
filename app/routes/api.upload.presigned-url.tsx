/**
 * API endpoint for generating presigned R2 upload URLs
 * Enables direct browser-to-R2 uploads without going through the server
 *
 * POST /api/upload/presigned-url
 * Body: { projectId, interviewId?, filename, contentType, fileSize }
 * Returns: { uploadUrl, key, expiresAt } or multipart info for large files
 */
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { z } from "zod"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { completeMultipartUploadServer, createR2MultipartUpload, createR2PresignedUploadUrl } from "~/utils/r2.server"

const MULTIPART_THRESHOLD = 100 * 1024 * 1024 // 100MB
const PART_SIZE = 10 * 1024 * 1024 // 10MB chunks

const RequestSchema = z.object({
	projectId: z.string().uuid(),
	interviewId: z.string().uuid().optional(),
	filename: z.string().min(1),
	contentType: z.string().min(1),
	fileSize: z.number().positive(),
})

const CompleteMultipartSchema = z.object({
	key: z.string(),
	uploadId: z.string(),
	parts: z.array(
		z.object({
			partNumber: z.number(),
			etag: z.string(),
		})
	),
})

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const body = await request.json()
		const url = new URL(request.url)
		const action = url.searchParams.get("action")

		// Handle multipart complete action
		if (action === "complete") {
			const parsed = CompleteMultipartSchema.safeParse(body)
			if (!parsed.success) {
				return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
			}

			const { key, uploadId, parts } = parsed.data
			const result = await completeMultipartUploadServer({
				key,
				uploadId,
				parts,
			})

			if (!result.success) {
				return Response.json({ error: result.error ?? "Failed to complete multipart upload" }, { status: 500 })
			}

			return Response.json({ success: true, key })
		}

		// Handle presigned URL request
		const parsed = RequestSchema.safeParse(body)
		if (!parsed.success) {
			return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
		}

		const { projectId, interviewId, filename, contentType, fileSize } = parsed.data

		// Generate R2 key
		const timestamp = Date.now()
		const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
		const extension = sanitizedFilename.split(".").pop() || "bin"
		const keyBase = interviewId
			? `interviews/${projectId}/${interviewId}-${timestamp}`
			: `interviews/${projectId}/upload-${timestamp}`
		const key = `${keyBase}.${extension}`

		consola.info("[presigned-url] Generating upload URL", {
			projectId,
			interviewId,
			filename,
			fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
			useMultipart: fileSize > MULTIPART_THRESHOLD,
		})

		// Use multipart for large files
		if (fileSize > MULTIPART_THRESHOLD) {
			const totalParts = Math.ceil(fileSize / PART_SIZE)
			const multipart = await createR2MultipartUpload({
				key,
				contentType,
				totalParts,
				expiresInSeconds: 3600, // 1 hour
			})

			if (!multipart) {
				consola.error("[presigned-url] Failed to create multipart upload")
				return Response.json({ error: "Failed to create upload session" }, { status: 500 })
			}

			consola.info("[presigned-url] Multipart upload created", {
				uploadId: multipart.uploadId,
				totalParts,
			})

			return Response.json({
				type: "multipart",
				key: multipart.key,
				uploadId: multipart.uploadId,
				partUrls: multipart.partUrls,
				partSize: PART_SIZE,
				totalParts,
				expiresAt: multipart.expiresAt,
			})
		}

		// Single file upload for smaller files
		const presigned = createR2PresignedUploadUrl({
			key,
			contentType,
			expiresInSeconds: 3600, // 1 hour
		})

		if (!presigned) {
			consola.error("[presigned-url] Failed to create presigned URL")
			return Response.json({ error: "Failed to create upload URL" }, { status: 500 })
		}

		consola.info("[presigned-url] Single upload URL created", { key })

		return Response.json({
			type: "single",
			uploadUrl: presigned.uploadUrl,
			key: presigned.key,
			expiresAt: presigned.expiresAt,
		})
	} catch (error) {
		consola.error("[presigned-url] Unexpected error:", error)
		return Response.json(
			{
				error: error instanceof Error ? error.message : "Internal server error",
			},
			{ status: 500 }
		)
	}
}
