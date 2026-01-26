/**
 * API endpoint to enable public sharing for an interview.
 * Generates a unique share token and sets expiration based on user selection.
 */
import consola from "consola";
import { nanoid } from "nanoid";
import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { userContext } from "~/server/user-context";

const EnableShareSchema = z.object({
  interviewId: z.string().uuid(),
  expirationDays: z.enum(["7", "30", "never"]),
});

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  if (!supabase) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = EnableShareSchema.safeParse({
    interviewId: formData.get("interviewId"),
    expirationDays: formData.get("expirationDays"),
  });

  if (!parsed.success) {
    consola.warn("[share.enable] Invalid payload", parsed.error.flatten());
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { interviewId, expirationDays } = parsed.data;

  try {
    // Verify user has access to this interview via RLS
    const { data: interview, error: fetchError } = await supabase
      .from("interviews")
      .select("id, share_token")
      .eq("id", interviewId)
      .single();

    if (fetchError || !interview) {
      consola.warn("[share.enable] Interview not found or no access", {
        interviewId,
        error: fetchError,
      });
      return Response.json({ error: "Interview not found" }, { status: 404 });
    }

    // Generate new token or reuse existing one
    const shareToken = interview.share_token || nanoid(12);

    // Calculate expiration date
    let shareExpiresAt: string | null = null;
    if (expirationDays !== "never") {
      const days = Number.parseInt(expirationDays, 10);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      shareExpiresAt = expiresAt.toISOString();
    }

    const { error: updateError } = await supabase
      .from("interviews")
      .update({
        share_token: shareToken,
        share_enabled: true,
        share_expires_at: shareExpiresAt,
        share_created_at: interview.share_token
          ? undefined
          : new Date().toISOString(),
      })
      .eq("id", interviewId);

    if (updateError) {
      consola.error("[share.enable] Failed to enable sharing", {
        interviewId,
        error: updateError,
      });
      return Response.json(
        { error: "Failed to enable sharing" },
        { status: 500 },
      );
    }

    consola.info("[share.enable] Sharing enabled", {
      interviewId,
      shareToken,
      expirationDays,
    });

    // Track interview_shared event for PLG instrumentation
    try {
      const posthogServer = getPostHogServerClient();
      if (posthogServer) {
        // Get account_id and project_id from interview
        const { data: interviewDetails } = await supabase
          .from("interviews")
          .select("account_id, project_id")
          .eq("id", interviewId)
          .single();

        if (interviewDetails) {
          const userId = ctx.claims.sub;
          posthogServer.capture({
            distinctId: userId,
            event: "interview_shared",
            properties: {
              interview_id: interviewId,
              project_id: interviewDetails.project_id,
              account_id: interviewDetails.account_id,
              share_type: "public_link",
              expiration_days: expirationDays,
              $groups: { account: interviewDetails.account_id },
            },
          });
        }
      }
    } catch (trackingError) {
      consola.warn(
        "[INTERVIEW_SHARED] PostHog tracking failed:",
        trackingError,
      );
    }

    return Response.json({
      ok: true,
      shareToken,
      shareUrl: `/s/${shareToken}`,
      expiresAt: shareExpiresAt,
    });
  } catch (error) {
    consola.error("[share.enable] Unexpected error", { error });
    return Response.json(
      { error: "Failed to enable sharing" },
      { status: 500 },
    );
  }
}
