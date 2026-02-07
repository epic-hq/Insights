import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticateDesktopRequest } from "~/lib/auth/desktop-auth.server";

/**
 * POST /api/desktop/interviews
 * Creates or upserts an interview record for a desktop recording session.
 * Called when a meeting starts in the desktop app.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const auth = await authenticateDesktopRequest(request);
  if (!auth) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { supabase, user } = auth;

  try {
    const body = await request.json();
    const {
      // Required
      account_id,
      project_id,
      title,
      // Optional
      desktop_meeting_id, // Local meeting ID from desktop app for tracking
      platform, // google-meet, zoom, teams, etc.
      interview_id, // For upsert - if provided, updates existing record
    } = body;

    if (!account_id || !project_id) {
      return Response.json(
        { error: "account_id and project_id are required" },
        { status: 400 },
      );
    }

    // Upsert logic: if interview_id provided, update; otherwise create
    if (interview_id) {
      // Update existing interview
      const { data: updated, error } = await supabase
        .from("interviews")
        .update({
          title: title || undefined,
          // Don't overwrite other fields on update
        })
        .eq("id", interview_id)
        .select("id, title, status")
        .single();

      if (error) {
        console.error("Failed to update interview:", error);
        return Response.json(
          { error: "Failed to update interview" },
          { status: 500 },
        );
      }

      return Response.json({
        success: true,
        interview_id: updated.id,
        title: updated.title,
        status: updated.status,
        action: "updated",
      });
    }

    // Create new interview
    const interviewData = {
      account_id,
      project_id,
      title: title || `Meeting - ${new Date().toLocaleTimeString()}`,
      interview_date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
      source_type: "realtime_recording",
      interview_type: "meeting",
      media_type: "meeting",
      status: "transcribing" as const, // Recording in progress
      created_by: user?.id || null,
      meeting_platform: platform || null,
      processing_metadata: {
        desktop_meeting_id,
        platform,
        started_at: new Date().toISOString(),
      },
    };

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert(interviewData)
      .select("id, title, status")
      .single();

    if (error) {
      console.error("Failed to create interview:", error);
      return Response.json(
        { error: "Failed to create interview" },
        { status: 500 },
      );
    }

    console.log(`Created interview ${interview.id} for desktop recording`);

    return Response.json({
      success: true,
      interview_id: interview.id,
      title: interview.title,
      status: interview.status,
      action: "created",
    });
  } catch (error) {
    console.error("Interview creation error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/desktop/interviews
 * Updates an interview with transcript and evidence data.
 * Called periodically during recording to sync data.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  // GET not supported - use POST for creation
  return Response.json(
    { error: "Use POST to create interviews" },
    { status: 405 },
  );
}
