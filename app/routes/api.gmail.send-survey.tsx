/**
 * Send Survey via Gmail
 *
 * POST /api/gmail/send-survey
 * Sends survey invite emails to a list of recipients via the user's Gmail connection.
 * Processes in small batches per Google rate limits.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import {
  createSurveySends,
  getGmailConnection,
  sendGmailEmail,
} from "~/lib/integrations/gmail.server";
import { userContext } from "~/server/user-context";

/** Max emails per batch to stay within Google rate limits */
const BATCH_SIZE = 10;
/** Delay between batches in ms */
const BATCH_DELAY_MS = 1000;

interface Recipient {
  email: string;
  name?: string;
  personId?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Build personalized survey link */
function buildSurveyLink(
  domain: string,
  slug: string,
  recipientEmail: string,
): string {
  const url = new URL(`/ask/${slug}`, domain);
  url.searchParams.set("ref", "email");
  url.searchParams.set("email", recipientEmail);
  return url.toString();
}

/** Build HTML email body */
function buildEmailHtml(params: {
  recipientName: string;
  senderName: string;
  surveyName: string;
  surveyLink: string;
  customMessage?: string;
}): string {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";

  const message =
    params.customMessage ||
    `I'd love to get your feedback. It only takes a few minutes.`;

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

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const userId = ctx?.claims?.sub;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    accountId,
    projectId,
    surveyId,
    surveySlug,
    surveyName,
    subject,
    customMessage,
    recipients,
  } = body as {
    accountId: string;
    projectId: string;
    surveyId: string;
    surveySlug: string;
    surveyName: string;
    subject: string;
    customMessage?: string;
    recipients: Recipient[];
  };

  if (!accountId || !projectId || !surveyId || !surveySlug || !subject) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!recipients || recipients.length === 0) {
    return Response.json({ error: "No recipients provided" }, { status: 400 });
  }

  // Get Gmail connection
  const connection = await getGmailConnection(ctx.supabase, userId, accountId);
  if (!connection) {
    return Response.json(
      { error: "Gmail not connected. Please connect Gmail first." },
      { status: 400 },
    );
  }

  const fromEmail = connection.email || "me";
  // Always use production URL for email links — even from local dev, recipients
  // need publicly routable URLs.
  const domain = "https://getupsight.com";

  // Send in batches
  const results: Array<{
    email: string;
    success: boolean;
    messageId?: string;
    threadId?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (recipient) => {
      const recipientName = recipient.name || "";
      const surveyLink = buildSurveyLink(domain, surveySlug, recipient.email);

      try {
        const emailHtml = buildEmailHtml({
          recipientName,
          senderName: fromEmail,
          surveyName,
          surveyLink,
          customMessage,
        });

        const result = await sendGmailEmail({
          connectionKey: connection.pica_connection_key,
          to: recipient.email,
          toName: recipientName || undefined,
          from: fromEmail,
          subject,
          bodyHtml: emailHtml,
        });

        return {
          email: recipient.email,
          success: true,
          messageId: result.messageId,
          threadId: result.threadId,
        };
      } catch (error) {
        consola.error("[gmail] Failed to send to", recipient.email, error);
        return {
          email: recipient.email,
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to send email",
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < recipients.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Create survey_sends records for successful sends
  const successfulSends = results.filter((r) => r.success);
  if (successfulSends.length > 0) {
    try {
      await createSurveySends(
        ctx.supabase,
        successfulSends.map((r) => {
          const recipient = recipients.find((rec) => rec.email === r.email);
          return {
            account_id: accountId,
            project_id: projectId,
            survey_id: surveyId,
            gmail_connection_id: connection.id,
            person_id: recipient?.personId || null,
            to_email: r.email,
            to_name: recipient?.name || null,
            subject,
            from_email: fromEmail,
            personalized_link: buildSurveyLink(domain, surveySlug, r.email),
            gmail_message_id: r.messageId || null,
            gmail_thread_id: r.threadId || null,
          };
        }),
      );
    } catch (error) {
      consola.error("[gmail] Failed to create survey_sends records:", error);
      // Don't fail the response — emails were already sent
    }
  }

  const sent = successfulSends.length;
  const failed = results.filter((r) => !r.success).length;

  consola.info("[gmail] Survey send complete", {
    surveyId,
    sent,
    failed,
    total: recipients.length,
  });

  return Response.json({
    success: true,
    sent,
    failed,
    total: recipients.length,
    results,
  });
}
