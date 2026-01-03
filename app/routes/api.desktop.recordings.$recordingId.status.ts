import type { LoaderFunctionArgs } from "react-router"
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server"

/**
 * GET /api/desktop/recordings/:recordingId/status
 * Poll processing status for a recording uploaded via Recall.ai.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
	const auth = await authenticateDesktopRequest(request)
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 })
	}

	const { supabase } = auth
	const { recordingId } = params
	const url = new URL(request.url)
	const accountId = url.searchParams.get("account_id")

	if (!recordingId) {
		return Response.json({ error: "Recording ID is required" }, { status: 400 })
	}

	try {
		// Look up interview by recall_recording_id
		let query = supabase
			.from("interviews")
			.select(
				`
				id,
				recall_recording_id,
				status,
				title,
				created_at,
				updated_at,
				account_id,
				project_id,
				projects!inner (
					slug,
					accounts!inner (
						slug
					)
				)
			`
			)
			.eq("recall_recording_id", recordingId)

		// If account_id provided, filter by it
		if (accountId) {
			query = query.eq("account_id", accountId)
		}

		const { data: interview, error } = await query.maybeSingle()

		if (error) {
			console.error("Error fetching interview:", error)
			return Response.json({ error: "Internal server error" }, { status: 500 })
		}

		// Recording not found - webhook hasn't been received yet
		if (!interview) {
			return Response.json({
				recall_recording_id: recordingId,
				status: "pending",
				error: "Recording not found - webhook may not have been received yet",
			})
		}

		// Build web URL
		const accountSlug = (interview.projects as any)?.accounts?.slug
		const projectSlug = (interview.projects as any)?.slug
		const webUrl =
			accountSlug && projectSlug
				? `https://getupsight.com/a/${interview.account_id}/${interview.project_id}/interviews/${interview.id}`
				: null

		// Map interview status to progress indicators
		const isCompleted = interview.status === "processed" || interview.status === "analyzed"
		const progress = {
			media_downloaded: true, // Always true if we have an interview record
			transcript_complete: interview.status !== "uploading",
			evidence_extracted: interview.status === "analyzed",
			themes_linked: interview.status === "analyzed",
		}

		return Response.json({
			recall_recording_id: recordingId,
			status: isCompleted ? "completed" : "processing",
			interview_id: interview.id,
			title: interview.title,
			progress,
			created_at: interview.created_at,
			updated_at: interview.updated_at,
			...(isCompleted && webUrl ? { web_url: webUrl } : {}),
		})
	} catch (error) {
		console.error("Recording status error:", error)
		return Response.json({ error: "Internal server error" }, { status: 500 })
	}
}
