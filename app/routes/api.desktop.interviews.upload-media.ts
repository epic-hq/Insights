/**
 * POST /api/desktop/interviews/upload-media
 *
 * Handles media file upload from desktop recordings.
 * Uploads to R2 and returns a presigned URL for the interview.
 */
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server"
import { createR2PresignedUploadUrl, uploadToR2 } from "~/utils/r2.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const auth = await authenticateDesktopRequest(request)
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { supabase } = auth

	try {
		const contentType = request.headers.get("content-type") || ""

		// Handle JSON requests: presigned URL generation or upload confirmation
		if (contentType.includes("application/json")) {
			const body = await request.json()
			const { interview_id, file_name, file_type, file_size, action, r2_key } = body

			// Confirm upload: update interview media_url after presigned URL upload
			if (action === "confirm") {
				if (!interview_id || !r2_key) {
					return Response.json({ error: "interview_id and r2_key are required for confirm" }, { status: 400 })
				}

				// Verify interview exists and user has access (RLS enforced by supabase)
				const { data: interview, error: fetchError } = await supabase
					.from("interviews")
					.select("id, account_id")
					.eq("id", interview_id)
					.single()

				if (fetchError || !interview) {
					return Response.json({ error: "Interview not found" }, { status: 404 })
				}

				// Validate r2_key matches expected pattern for this interview
				const expectedPrefix = `interviews/${interview.account_id}/${interview_id}/`
				if (!r2_key.startsWith(expectedPrefix)) {
					return Response.json({ error: "Invalid R2 key for this interview" }, { status: 400 })
				}

				const { error: updateError } = await supabase
					.from("interviews")
					.update({
						media_url: r2_key,
						processing_metadata: {
							media_uploaded_at: new Date().toISOString(),
							media_size_bytes: file_size || null,
							media_type: file_type || "video/mp4",
						},
					})
					.eq("id", interview_id)

				if (updateError) {
					consola.error("[desktop-upload-media] Failed to confirm upload:", updateError.message)
					return Response.json({ error: "Failed to confirm upload" }, { status: 500 })
				}

				consola.info(`[desktop-upload-media] Confirmed upload for interview ${interview_id}: ${r2_key}`)
				return Response.json({ success: true, r2_key })
			}

			// Generate presigned upload URL
			if (!interview_id || !file_name) {
				return Response.json({ error: "interview_id and file_name are required" }, { status: 400 })
			}

			// Verify interview exists
			const { data: interview, error: interviewError } = await supabase
				.from("interviews")
				.select("id, account_id")
				.eq("id", interview_id)
				.single()

			if (interviewError || !interview) {
				return Response.json({ error: "Interview not found" }, { status: 404 })
			}

			// Generate R2 key for this media file
			const extension = file_name.split(".").pop() || "mp4"
			const r2Key = `interviews/${interview.account_id}/${interview_id}/recording.${extension}`

			// Get presigned upload URL
			const presignedResult = createR2PresignedUploadUrl({
				key: r2Key,
				contentType: file_type || "video/mp4",
				expiresInSeconds: 3600, // 1 hour to upload
			})

			if (!presignedResult) {
				consola.error("[desktop-upload-media] Failed to create presigned URL")
				return Response.json({ error: "Failed to create upload URL" }, { status: 500 })
			}

			consola.info(`[desktop-upload-media] Created presigned URL for interview ${interview_id}`, { r2Key, file_size })

			return Response.json({
				upload_url: presignedResult.uploadUrl,
				r2_key: r2Key,
				expires_at: presignedResult.expiresAt,
			})
		}

		// Handle multipart form data upload (direct upload)
		if (contentType.includes("multipart/form-data")) {
			const formData = await request.formData()
			const file = formData.get("file") as File | null
			const interviewId = formData.get("interview_id") as string | null

			if (!file || !interviewId) {
				return Response.json({ error: "file and interview_id are required" }, { status: 400 })
			}

			// Verify interview exists
			const { data: interview, error: interviewError } = await supabase
				.from("interviews")
				.select("id, account_id")
				.eq("id", interviewId)
				.single()

			if (interviewError || !interview) {
				return Response.json({ error: "Interview not found" }, { status: 404 })
			}

			// Read file as buffer
			const arrayBuffer = await file.arrayBuffer()
			const buffer = new Uint8Array(arrayBuffer)

			// Generate R2 key
			const extension = file.name.split(".").pop() || "mp4"
			const r2Key = `interviews/${interview.account_id}/${interviewId}/recording.${extension}`

			// Upload to R2
			const uploadResult = await uploadToR2({
				key: r2Key,
				body: buffer,
				contentType: file.type || "video/mp4",
			})

			if (!uploadResult.success) {
				consola.error(
					"[desktop-upload-media] Upload failed:",
					"error" in uploadResult ? uploadResult.error : "Unknown error"
				)
				return Response.json({ error: "Upload failed" }, { status: 500 })
			}

			// Update interview with media URL
			const { error: updateError } = await supabase
				.from("interviews")
				.update({
					media_url: r2Key,
					processing_metadata: {
						media_uploaded_at: new Date().toISOString(),
						media_size_bytes: buffer.length,
						media_type: file.type,
					},
				})
				.eq("id", interviewId)

			if (updateError) {
				consola.error("[desktop-upload-media] Failed to update interview:", updateError.message)
			}

			consola.info(
				`[desktop-upload-media] Uploaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB for interview ${interviewId}`
			)

			return Response.json({
				success: true,
				r2_key: r2Key,
				size_bytes: buffer.length,
			})
		}

		return Response.json({ error: "Unsupported content type" }, { status: 415 })
	} catch (error: any) {
		consola.error("[desktop-upload-media] Error:", error)
		return Response.json({ error: error?.message || "Upload failed" }, { status: 500 })
	}
}
