import type { LoaderFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"
import { createR2PresignedUrl } from "~/utils/r2.server"

/**
 * Generate a fresh presigned URL for accessing media files in R2
 * This is needed because presigned URLs expire after 24 hours
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
	try {
		// Verify authentication via userContext
		const ctx = context.get(userContext)
		if (!ctx?.account_id) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get the R2 key from query params
		const url = new URL(request.url)
		const key = url.searchParams.get("key")

		if (!key) {
			return Response.json({ error: "Missing 'key' parameter" }, { status: 400 })
		}

		// Generate a fresh presigned URL (valid for 1 hour)
		const presignedResult = createR2PresignedUrl({
			key,
			expiresInSeconds: 60 * 60, // 1 hour
		})

		if (!presignedResult) {
			return Response.json({ error: "Failed to generate presigned URL" }, { status: 500 })
		}

		return Response.json({
			url: presignedResult.url,
			expiresAt: presignedResult.expiresAt,
		})
	} catch (error) {
		console.error("Failed to generate media URL:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
	}
}
