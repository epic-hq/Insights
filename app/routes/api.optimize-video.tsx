/**
 * Trigger video optimization for an existing interview.
 * Looks up the interview's media_url and fires interview.optimize-video.
 *
 * POST /api/optimize-video
 * Body: { interviewId: string }
 */

import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import {
  createSupabaseAdminClient,
  getAuthenticatedUser,
} from "~/lib/supabase/client.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { user } = await getAuthenticatedUser(request);
  if (!user?.sub) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { interviewId } = await request.json();
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

  // Use original video key if available, otherwise current media_url
  const metadata = (interview.processing_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const sourceR2Key =
    (metadata.original_video_r2_key as string | undefined) ??
    interview.media_url;

  if (!sourceR2Key) {
    return Response.json(
      { error: "No video file found for this interview" },
      { status: 400 },
    );
  }

  const handle = await tasks.trigger("interview.optimize-video", {
    interviewId: interview.id,
    sourceR2Key,
    accountId: interview.account_id,
    projectId: interview.project_id ?? "",
  });

  consola.info("[optimize-video] Triggered", {
    interviewId,
    sourceR2Key,
    runId: handle.id,
  });

  return Response.json({ success: true, runId: handle.id, sourceR2Key });
}
