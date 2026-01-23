/**
 * API endpoint for uploading walkthrough videos to R2
 * POST /api/research-links/:listId/upload-walkthrough
 */
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { generateWalkthroughThumbnail } from "~/../../src/trigger/generate-walkthrough-thumbnail"
import { getServerClient } from "~/lib/supabase/client.server"
import { createR2PresignedUrl, uploadToR2 } from "~/utils/r2.server"

const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB for longer walkthroughs
const ALLOWED_TYPE_PREFIXES = ["video/webm", "video/mp4", "video/quicktime"]

function isAllowedVideoType(mimeType: string): boolean {
	// Handle MIME types with codec info like "video/webm;codecs=vp9"
	const baseType = mimeType.split(";")[0].trim()
	return ALLOWED_TYPE_PREFIXES.includes(baseType)
}

export async function action({ request, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	const { listId } = params
	if (!listId) {
		return Response.json({ error: "Missing list ID" }, { status: 400 })
	}

	// Create authenticated client
	const { client: supabase, headers } = getServerClient(request)

	// Get current user
	const {
		data: { user },
	} = await supabase.auth.getUser()

	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401, headers })
	}

	try {
		const formData = await request.formData()
		const videoFile = formData.get("video") as File | null

		if (!videoFile) {
			return Response.json({ error: "No video file provided" }, { status: 400, headers })
		}

		// Validate file type
		if (!isAllowedVideoType(videoFile.type)) {
			return Response.json(
				{
					error: `Invalid file type. Allowed: ${ALLOWED_TYPE_PREFIXES.join(", ")}`,
				},
				{ status: 400, headers }
			)
		}

		// Validate file size
		if (videoFile.size > MAX_VIDEO_SIZE) {
			return Response.json(
				{
					error: `File too large. Maximum size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
				},
				{ status: 400, headers }
			)
		}

		// Verify the user has access to this research link
		const { data: link, error: linkError } = await supabase
			.from("research_links")
			.select("id, account_id")
			.eq("id", listId)
			.single()

		if (linkError || !link) {
			return Response.json({ error: "Ask link not found" }, { status: 404, headers })
		}

		// Determine file extension (handle MIME types with codec info)
		const baseType = videoFile.type.split(";")[0].trim()
		const ext = baseType === "video/webm" ? "webm" : baseType === "video/mp4" ? "mp4" : "mov"

		// Upload to R2
		const key = `ask-walkthroughs/${link.id}/walkthrough.${ext}`
		const arrayBuffer = await videoFile.arrayBuffer()
		const body = new Uint8Array(arrayBuffer)

		consola.info("Uploading walkthrough video", {
			listId,
			size: videoFile.size,
			type: videoFile.type,
			key,
		})

		const uploadResult = await uploadToR2({
			key,
			body,
			contentType: videoFile.type,
		})

		if (!uploadResult.success) {
			consola.error("Failed to upload walkthrough video to R2", uploadResult)
			return Response.json({ error: "Failed to upload video" }, { status: 500, headers })
		}

		// Store the R2 key (not public URL) - signed URLs will be generated on access
		const { error: updateError } = await supabase
			.from("research_links")
			.update({ walkthrough_video_url: key, walkthrough_thumbnail_url: null })
			.eq("id", listId)

		if (updateError) {
			consola.error("Failed to update research link with walkthrough URL", updateError)
			return Response.json({ error: "Failed to save video URL" }, { status: 500, headers })
		}

		consola.info("Walkthrough video uploaded successfully", {
			listId,
			key,
		})

		try {
			const handle = await tasks.trigger<typeof generateWalkthroughThumbnail>("generate-walkthrough-thumbnail", {
				mediaKey: key,
				linkId: listId,
				accountId: link.account_id,
			})

			consola.info("Triggered walkthrough thumbnail generation", {
				listId,
				runId: handle.id,
			})
		} catch (thumbnailError) {
			consola.warn("Failed to trigger walkthrough thumbnail generation", {
				listId,
				error: thumbnailError,
			})
		}

		// Generate signed URL for immediate playback
		const presigned = createR2PresignedUrl({
			key,
			expiresInSeconds: 3600,
			responseContentType: baseType,
		})

		return Response.json(
			{
				success: true,
				videoKey: key,
				videoUrl: presigned?.url ?? null,
			},
			{ headers }
		)
	} catch (error) {
		consola.error("Error uploading walkthrough video", error)
		return Response.json({ error: "Internal server error" }, { status: 500, headers })
	}
}
