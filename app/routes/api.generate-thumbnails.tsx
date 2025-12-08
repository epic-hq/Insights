/**
 * API route to generate video thumbnails for interviews
 *
 * Supports:
 * - Single interview: POST with interview_id
 * - Batch backfill: POST with action=backfill to process all missing thumbnails
 * - Stats: POST with action=stats to get counts
 */

import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import type { generateThumbnail } from "~/../../src/trigger/generate-thumbnail"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"

// Video file extensions that support thumbnail generation
const VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "webm", "mkv", "m4v"]

function isVideoFile(mediaUrl: string | null): boolean {
	if (!mediaUrl) return false
	const ext = mediaUrl.split(".").pop()?.toLowerCase()
	return VIDEO_EXTENSIONS.includes(ext || "")
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const claims = await getAuthenticatedUser(request)
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		const { client: userDb } = getServerClient(request)
		const formData = await request.formData()
		const action = formData.get("action")?.toString()
		const interviewId = formData.get("interview_id")?.toString()
		const projectId = formData.get("project_id")?.toString()
		const limit = parseInt(formData.get("limit")?.toString() || "50", 10)

		// Get stats about interviews needing thumbnails
		if (action === "stats") {
			const { data: interviews, error } = await userDb
				.from("interviews")
				.select("id, media_url, thumbnail_url, project_id")
				.not("media_url", "is", null)

			if (error) {
				return Response.json({ error: error.message }, { status: 500 })
			}

			const videoInterviews = interviews?.filter((i) => isVideoFile(i.media_url)) || []
			const withThumbnails = videoInterviews.filter((i) => i.thumbnail_url)
			const withoutThumbnails = videoInterviews.filter((i) => !i.thumbnail_url)

			// Group by project
			const byProject: Record<string, { total: number; missing: number }> = {}
			for (const interview of videoInterviews) {
				const pid = interview.project_id || "no-project"
				if (!byProject[pid]) {
					byProject[pid] = { total: 0, missing: 0 }
				}
				byProject[pid].total++
				if (!interview.thumbnail_url) {
					byProject[pid].missing++
				}
			}

			return Response.json({
				success: true,
				stats: {
					totalVideos: videoInterviews.length,
					withThumbnails: withThumbnails.length,
					withoutThumbnails: withoutThumbnails.length,
					byProject,
				},
			})
		}

		// Generate thumbnail for a single interview
		if (interviewId) {
			const { data: interview, error } = await userDb
				.from("interviews")
				.select("id, media_url, account_id")
				.eq("id", interviewId)
				.single()

			if (error || !interview) {
				return Response.json({ error: "Interview not found" }, { status: 404 })
			}

			if (!interview.media_url) {
				return Response.json({ error: "Interview has no media file" }, { status: 400 })
			}

			if (!isVideoFile(interview.media_url)) {
				return Response.json({ error: "Interview media is not a video file" }, { status: 400 })
			}

			// Extract R2 key from media_url
			// media_url can be either a full URL or just the R2 key
			let mediaKey = interview.media_url
			if (mediaKey.includes("/")) {
				// If it's a URL, extract the key (last part of path)
				const url = new URL(mediaKey, "https://placeholder.com")
				mediaKey = url.pathname.replace(/^\//, "")
			}

			consola.info(`Triggering thumbnail generation for interview ${interviewId}`)

			const handle = await tasks.trigger<typeof generateThumbnail>("generate-thumbnail", {
				mediaKey,
				interviewId: interview.id,
				accountId: interview.account_id,
			})

			return Response.json({
				success: true,
				runId: handle.id,
				interviewId,
			})
		}

		// Batch backfill for all interviews without thumbnails
		if (action === "backfill") {
			let query = userDb
				.from("interviews")
				.select("id, media_url, account_id, project_id")
				.not("media_url", "is", null)
				.is("thumbnail_url", null)
				.limit(limit)

			// Optionally filter by project
			if (projectId) {
				query = query.eq("project_id", projectId)
			}

			const { data: interviews, error } = await query

			if (error) {
				return Response.json({ error: error.message }, { status: 500 })
			}

			// Filter to only video files
			const videoInterviews = interviews?.filter((i) => isVideoFile(i.media_url)) || []

			if (videoInterviews.length === 0) {
				return Response.json({
					success: true,
					message: "No videos need thumbnails",
					triggered: 0,
				})
			}

			// Batch trigger thumbnail generation
			const payloads = videoInterviews.map((interview) => {
				let mediaKey = interview.media_url!
				if (mediaKey.includes("/")) {
					const url = new URL(mediaKey, "https://placeholder.com")
					mediaKey = url.pathname.replace(/^\//, "")
				}

				return {
					payload: {
						mediaKey,
						interviewId: interview.id,
						accountId: interview.account_id,
					},
				}
			})

			consola.info(`Batch triggering thumbnail generation for ${payloads.length} interviews`)

			const batchHandle = await tasks.batchTrigger<typeof generateThumbnail>("generate-thumbnail", payloads)

			return Response.json({
				success: true,
				batchId: batchHandle.batchId,
				triggered: payloads.length,
				interviewIds: videoInterviews.map((i) => i.id),
			})
		}

		return Response.json(
			{ error: "Invalid request. Provide interview_id, or action=stats/backfill" },
			{ status: 400 }
		)
	} catch (error) {
		consola.error("Generate thumbnails API error:", error)
		return Response.json({ error: error instanceof Error ? error.message : "Internal error" }, { status: 500 })
	}
}
