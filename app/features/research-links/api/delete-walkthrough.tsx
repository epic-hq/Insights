/**
 * API endpoint for deleting walkthrough videos
 * POST /api/research-links/:listId/delete-walkthrough
 *
 * Uses POST with useFetcher (not raw DELETE) for compatibility with Hono middleware
 */
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getServerClient } from "~/lib/supabase/client.server"
import { deleteFromR2 } from "~/utils/r2.server"

export const loader = () => Response.json({ error: "Method not allowed" }, { status: 405 })

export async function action({ request, params }: ActionFunctionArgs) {
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
		// Fetch the research link to get the video URL
		const { data: link, error: linkError } = await supabase
			.from("research_links")
			.select("id, walkthrough_video_url, walkthrough_thumbnail_url")
			.eq("id", listId)
			.maybeSingle()

		if (linkError) {
			consola.error("Failed to fetch research link for delete", {
				listId,
				userId: user.id,
				error: linkError,
			})
			return Response.json({ error: `Database error: ${linkError.message}` }, { status: 500, headers })
		}

		if (!link) {
			return Response.json({ error: "Ask link not found or access denied" }, { status: 404, headers })
		}

		// Delete the video from R2 if it exists
		if (link.walkthrough_video_url) {
			const deleteResult = await deleteFromR2(link.walkthrough_video_url)
			if (!deleteResult.success) {
				consola.warn("Failed to delete video from R2, continuing anyway", {
					key: link.walkthrough_video_url,
					error: deleteResult.error,
				})
				// Continue anyway - we'll still clear the DB reference
			}
		}

		if (link.walkthrough_thumbnail_url) {
			const deleteResult = await deleteFromR2(link.walkthrough_thumbnail_url)
			if (!deleteResult.success) {
				consola.warn("Failed to delete walkthrough thumbnail from R2, continuing anyway", {
					key: link.walkthrough_thumbnail_url,
					error: deleteResult.error,
				})
			}
		}

		// Clear the walkthrough video URL in the database
		const { error: updateError } = await supabase
			.from("research_links")
			.update({ walkthrough_video_url: null, walkthrough_thumbnail_url: null })
			.eq("id", listId)

		if (updateError) {
			consola.error("Failed to clear walkthrough video URL", {
				listId,
				userId: user.id,
				error: updateError,
			})
			return Response.json({ error: `Failed to delete video: ${updateError.message}` }, { status: 500, headers })
		}

		consola.info("Walkthrough video deleted", { listId, userId: user.id })

		return Response.json({ success: true }, { headers })
	} catch (error) {
		consola.error("Error deleting walkthrough video", error)
		return Response.json({ error: "Internal server error" }, { status: 500, headers })
	}
}
