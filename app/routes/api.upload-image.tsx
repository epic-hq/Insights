/**
 * API endpoint for uploading images to R2
 *
 * POST /api/upload-image
 * - Accepts multipart form data with an image file
 * - Returns the R2 key and a presigned URL
 *
 * Query params:
 * - category: folder category (e.g., "avatars", "thumbnails")
 * - entityId: ID to associate with the image
 * - suffix: optional custom suffix for filename
 */

import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { getImageUrl, storeImage } from "~/utils/storeImage.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	// Authenticate user
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	try {
		const url = new URL(request.url)
		const category = url.searchParams.get("category") || "uploads"
		const rawEntityId = url.searchParams.get("entityId")
		const entityId = rawEntityId && rawEntityId !== "undefined" && rawEntityId !== "null" ? rawEntityId : user.sub
		const suffix = url.searchParams.get("suffix") || undefined
		if (!entityId) {
			return Response.json({ error: "Missing entityId" }, { status: 400 })
		}

		// Parse multipart form data
		const formData = await request.formData()
		const file = formData.get("file") as File | null

		if (!file || !(file instanceof File)) {
			return Response.json({ error: "No file provided. Expected 'file' field in form data." }, { status: 400 })
		}

		// Store the image
		const result = await storeImage({
			category,
			entityId,
			source: file,
			originalFilename: file.name,
			suffix,
		})

		if (result.error || !result.imageKey) {
			return Response.json({ error: result.error || "Failed to upload image" }, { status: 400 })
		}

		return Response.json({
			success: true,
			imageKey: result.imageKey,
			url: result.presignedUrl,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error"
		return Response.json({ error: message }, { status: 500 })
	}
}

/**
 * GET /api/upload-image?key=...
 * Returns a fresh presigned URL for an existing image
 */
export async function loader({ request }: ActionFunctionArgs) {
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const url = new URL(request.url)
	const imageKey = url.searchParams.get("key")
	const expiresIn = Number(url.searchParams.get("expiresIn")) || 3600

	if (!imageKey) {
		return Response.json({ error: "Missing 'key' parameter" }, { status: 400 })
	}

	const presignedUrl = getImageUrl(imageKey, expiresIn)
	if (!presignedUrl) {
		return Response.json({ error: "Failed to generate URL" }, { status: 500 })
	}

	return Response.json({
		success: true,
		url: presignedUrl,
		expiresIn,
	})
}
