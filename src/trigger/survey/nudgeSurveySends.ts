/**
 * Survey Nudge Task
 *
 * Scheduled task that sends reminder emails to survey recipients who haven't
 * responded yet. Runs hourly and checks survey_sends for pending nudges.
 *
 * Nudge schedule:
 * - Nudge 1: Day 3 after initial send
 * - Nudge 2: Day 7 after initial send
 * - After 2 nudges: stop (nudge_enabled = false)
 */

import { schedules } from "@trigger.dev/sdk";
import consola from "consola";
import type { GmailConnection } from "~/lib/integrations/gmail.server";
import { sendGmailEmail } from "~/lib/integrations/gmail.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/** Max nudge emails per run to stay within rate limits */
const MAX_NUDGES_PER_RUN = 50;

/** Delay between sends in ms */
const SEND_DELAY_MS = 500;

/** Max number of nudges before stopping */
const MAX_NUDGE_COUNT = 2;

/** Days between nudges */
const NUDGE_INTERVAL_DAYS = 4; // nudge 1 at day 3, nudge 2 at day 7

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build nudge email HTML */
function buildNudgeHtml(params: {
  recipientName: string;
  senderName: string;
  surveyName: string;
  surveyLink: string;
  nudgeCount: number;
}): string {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";

  const message =
    params.nudgeCount === 0
      ? `Just a friendly reminder — I'd love to hear your thoughts. It only takes a few minutes.`
      : `I know you're busy, but your feedback would really help. Just a few minutes is all it takes.`;

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
  <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
    ${greeting}
  </p>
  <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
    ${message}
  </p>
  <p style="margin: 0 0 24px;">
    <a href="${params.surveyLink}" style="display: inline-block; padding: 10px 24px; background-color: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
      Take the Survey
    </a>
  </p>
  <p style="margin: 0 0 8px; color: #1a1a1a; font-size: 15px; line-height: 1.6;">
    Thanks,<br/>${params.senderName}
  </p>
  <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px;">
    Sent via <a href="https://getupsight.com" style="color: #9ca3af;">UpSight</a>
  </p>
</div>`.trim();
}

/**
 * Hourly scheduled task to send nudge reminders
 */
export const nudgeSurveySendsTask = schedules.task({
  id: "survey.nudge-sends",
  cron: "30 * * * *", // Every hour at minute 30 (offset from calendar sync)
  run: async () => {
    const db = createSupabaseAdminClient();
    const now = new Date().toISOString();

    consola.info("[survey.nudge] Starting nudge check");

    // Find sends that are due for a nudge
    const { data: pendingSends, error } = await db
      .from("survey_sends")
      .select(
        "id, survey_id, gmail_connection_id, to_email, to_name, subject, from_email, personalized_link, nudge_count, gmail_message_id, gmail_thread_id",
      )
      .eq("nudge_enabled", true)
      .in("status", ["sent", "opened"])
      .lte("next_nudge_at", now)
      .order("next_nudge_at", { ascending: true })
      .limit(MAX_NUDGES_PER_RUN);

    if (error) {
      consola.error("[survey.nudge] Failed to query pending sends:", error);
      throw error;
    }

    if (!pendingSends || pendingSends.length === 0) {
      consola.info("[survey.nudge] No pending nudges");
      return { nudged: 0, failed: 0 };
    }

    consola.info(`[survey.nudge] Found ${pendingSends.length} sends to nudge`);

    // Load Gmail connections needed (deduplicate by connection ID)
    const connectionIds = [
      ...new Set(pendingSends.map((s) => s.gmail_connection_id)),
    ];
    const { data: connections, error: connError } = await db
      .from("gmail_connections")
      .select("*")
      .in("id", connectionIds)
      .eq("is_active", true);

    if (connError) {
      consola.error("[survey.nudge] Failed to load connections:", connError);
      throw connError;
    }

    const connectionMap = new Map(
      (connections ?? []).map((c) => [c.id, c as unknown as GmailConnection]),
    );

    // Load survey names for email subject
    const surveyIds = [...new Set(pendingSends.map((s) => s.survey_id))];
    const { data: surveys } = await db
      .from("research_links")
      .select("id, name")
      .in("id", surveyIds);

    const surveyNameMap = new Map((surveys ?? []).map((s) => [s.id, s.name]));

    let nudged = 0;
    let failed = 0;

    for (const send of pendingSends) {
      const connection = connectionMap.get(send.gmail_connection_id);
      if (!connection) {
        consola.warn(
          `[survey.nudge] Connection not found for send ${send.id}, disabling nudges`,
        );
        await db
          .from("survey_sends")
          .update({ nudge_enabled: false })
          .eq("id", send.id);
        failed++;
        continue;
      }

      const surveyName =
        surveyNameMap.get(send.survey_id) || "Quick feedback request";

      try {
        const nudgeHtml = buildNudgeHtml({
          recipientName: send.to_name || "",
          senderName: send.from_email,
          surveyName,
          surveyLink: send.personalized_link || "",
          nudgeCount: send.nudge_count,
        });

        await sendGmailEmail({
          connectionKey: connection.pica_connection_key,
          to: send.to_email,
          toName: send.to_name || undefined,
          from: send.from_email,
          subject: `Re: ${send.subject}`,
          bodyHtml: nudgeHtml,
          // Thread the nudge onto the original email
          replyToMessageId: send.gmail_message_id || undefined,
          threadId: send.gmail_thread_id || undefined,
        });

        const newNudgeCount = send.nudge_count + 1;
        const shouldStopNudging = newNudgeCount >= MAX_NUDGE_COUNT;

        // Calculate next nudge time
        const nextNudgeAt = shouldStopNudging
          ? null
          : new Date(
              Date.now() + NUDGE_INTERVAL_DAYS * 24 * 60 * 60 * 1000,
            ).toISOString();

        await db
          .from("survey_sends")
          .update({
            nudge_count: newNudgeCount,
            last_nudged_at: new Date().toISOString(),
            next_nudge_at: nextNudgeAt,
            nudge_enabled: !shouldStopNudging,
          })
          .eq("id", send.id);

        nudged++;
        consola.info(
          `[survey.nudge] Nudged ${send.to_email} (nudge #${newNudgeCount})`,
        );
      } catch (err) {
        consola.error(`[survey.nudge] Failed to nudge ${send.to_email}:`, err);
        failed++;

        // If sending fails, don't retry immediately — push next_nudge_at forward
        await db
          .from("survey_sends")
          .update({
            next_nudge_at: new Date(
              Date.now() + 6 * 60 * 60 * 1000,
            ).toISOString(), // retry in 6 hours
            error_message:
              err instanceof Error ? err.message : "Nudge send failed",
          })
          .eq("id", send.id);
      }

      // Small delay between sends
      if (nudged + failed < pendingSends.length) {
        await sleep(SEND_DELAY_MS);
      }
    }

    consola.info("[survey.nudge] Complete", { nudged, failed });
    return { nudged, failed };
  },
});
