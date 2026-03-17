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
	const optimizationSourceR2Key = storedOriginalVideoKey ?? interview.media_url;
	// For thumbnails, prefer the optimized mp4 when it exists; otherwise fall back to the original upload.
	const thumbnailSourceR2Key =
		storedOriginalVideoKey && interview.media_url && interview.media_url !== storedOriginalVideoKey
			? interview.media_url
			: optimizationSourceR2Key;

	if (!optimizationSourceR2Key) {
		return Response.json({ error: "No video file found for this interview" }, { status: 400 });
	}

	if (thumbnailOnly) {
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
