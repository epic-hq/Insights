import type { LoaderFunctionArgs } from "react-router";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";

// Type for interview with recall_recording_id (pending migration)
interface InterviewWithRecall {
	id: string;
	recall_recording_id: string | null;
	status: string;
	title: string | null;
	created_at: string;
	updated_at: string;
	account_id: string;
	project_id: string;
	projects: {
		slug: string;
		accounts: { slug: string };
	} | null;
}

/**
 * GET /api/desktop/recordings/:recordingId/status
 * Poll processing status for a recording uploaded via Recall.ai.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
	const auth = await authenticateDesktopRequest(request);
	if (!auth) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { supabase } = auth;
	const { recordingId } = params;
	const url = new URL(request.url);
	const accountId = url.searchParams.get("account_id");

	if (!recordingId) {
		return Response.json({ error: "Recording ID is required" }, { status: 400 });
	}

	try {
		// Look up interview by recall_recording_id
		// Note: recall_recording_id column will be added by pending migration
		// Using type assertion until types are regenerated
		const baseQuery = supabase
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
			.eq("recall_recording_id" as string, recordingId);

		const query = accountId ? baseQuery.eq("account_id", accountId) : baseQuery;

		const { data, error } = await query.maybeSingle();
		const interview = data as InterviewWithRecall | null;

		if (error) {
			console.error("Error fetching interview:", error);
			return Response.json({ error: "Internal server error" }, { status: 500 });
		}

		// Recording not found - webhook hasn't been received yet
		if (!interview) {
			return Response.json({
				recall_recording_id: recordingId,
				status: "pending",
				error: "Recording not found - webhook may not have been received yet",
			});
		}

		// Build web URL
		const accountSlug = interview.projects?.accounts?.slug;
		const projectSlug = interview.projects?.slug;
		const webUrl =
			accountSlug && projectSlug
				? `https://getupsight.com/a/${interview.account_id}/${interview.project_id}/interviews/${interview.id}`
				: null;

		// Map interview status to progress indicators
		const isCompleted = interview.status === "processed" || interview.status === "analyzed";
		const progress = {
			media_downloaded: true, // Always true if we have an interview record
			transcript_complete: interview.status !== "uploading",
			evidence_extracted: interview.status === "analyzed",
			themes_linked: interview.status === "analyzed",
		};

		return Response.json({
			recall_recording_id: recordingId,
			status: isCompleted ? "completed" : "processing",
			interview_id: interview.id,
			title: interview.title,
			progress,
			created_at: interview.created_at,
			updated_at: interview.updated_at,
			...(isCompleted && webUrl ? { web_url: webUrl } : {}),
		});
	} catch (error) {
		console.error("Recording status error:", error);
		return Response.json({ error: "Internal server error" }, { status: 500 });
	}
}
