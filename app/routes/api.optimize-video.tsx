/**
 * Trigger video optimization or thumbnail extraction for an existing interview.
 *
 * POST /api/optimize-video
 * Body: { interviewId: string, thumbnailOnly?: boolean }
 *
 * thumbnailOnly=true: just extract thumbnail (fast, no re-encoding)
 * thumbnailOnly=false (default): full video re-encode + thumbnail
 */

import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { createSupabaseAdminClient, getAuthenticatedUser } from "~/lib/supabase/client.server";

function isVideoKey(key: string | null | undefined): boolean {
	if (!key) return false;
	const path = key.split("?")[0]?.toLowerCase() ?? "";
	return /\.(mp4|mov|avi|mkv|m4v|webm)$/i.test(path);
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const { user } = await getAuthenticatedUser(request);
	if (!user?.sub) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { interviewId, thumbnailOnly = false } = await request.json();
	if (!interviewId) {
		return Response.json({ error: "interviewId required" }, { status: 400 });
	}

	const supabase = createSupabaseAdminClient();

	const { data: interview, error } = await supabase
		.from("interviews")
		.select("id, account_id, project_id, media_url, processing_metadata")
		.eq("id", interviewId)
		.single();

	if (error || !interview) {
		return Response.json({ error: "Interview not found" }, { status: 404 });
	}

	const metadata = (interview.processing_metadata ?? {}) as Record<string, unknown>;
	const storedOriginalVideoKey =
		typeof metadata.original_video_r2_key === "string" ? metadata.original_video_r2_key : null;
	const optimizedVideoKey = isVideoKey(interview.media_url) ? interview.media_url : null;
	const optimizationSourceR2Key = storedOriginalVideoKey ?? optimizedVideoKey;
	const thumbnailSourceR2Key = optimizedVideoKey ?? storedOriginalVideoKey;

	if (!optimizationSourceR2Key || !isVideoKey(optimizationSourceR2Key)) {
		return Response.json({ error: "No video file found for this interview" }, { status: 400 });
	}

	if (thumbnailOnly) {
		if (!thumbnailSourceR2Key || !isVideoKey(thumbnailSourceR2Key)) {
			return Response.json({ error: "No video source available for thumbnail extraction" }, { status: 400 });
		}
		const handle = await tasks.trigger("generate-thumbnail", {
			mediaKey: thumbnailSourceR2Key,
			interviewId: interview.id,
			timestampSec: 1,
			accountId: interview.account_id,
		});
		consola.info("[optimize-video] Triggered thumbnail-only", {
			interviewId,
			mediaKey: thumbnailSourceR2Key,
			runId: handle.id,
		});
		return Response.json({
			success: true,
			mode: "thumbnail",
			runId: handle.id,
		});
	}

	const handle = await tasks.trigger("interview.optimize-video", {
		interviewId: interview.id,
		sourceR2Key: optimizationSourceR2Key,
		accountId: interview.account_id,
		projectId: interview.project_id ?? "",
	});

	consola.info("[optimize-video] Triggered full optimization", {
		interviewId,
		sourceR2Key: optimizationSourceR2Key,
		runId: handle.id,
	});
	return Response.json({
		success: true,
		mode: "optimize",
		runId: handle.id,
		sourceR2Key: optimizationSourceR2Key,
	});
}
