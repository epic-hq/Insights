/**
 * Gmail Integration Server Functions
 *
 * Database operations for Gmail connections and email sending via Pica Passthrough API.
 * Pattern matches calendar.server.ts for consistency.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import type { Database } from "~/types";
import { picaPassthrough } from "./pica.server";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface GmailConnection {
  id: string;
  user_id: string;
  account_id: string;
  pica_connection_id: string;
  pica_connection_key: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveySend {
  id: string;
  account_id: string;
  project_id: string;
  survey_id: string;
  gmail_connection_id: string;
  person_id: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  from_email: string;
  personalized_link: string | null;
  status: "sent" | "opened" | "completed" | "bounced" | "failed";
  sent_at: string;
  opened_at: string | null;
  completed_at: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  nudge_count: number;
  last_nudged_at: string | null;
  next_nudge_at: string | null;
  nudge_enabled: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Gmail Connection Operations
// -----------------------------------------------------------------------------

/**
 * Get user's Gmail connection for an account
 */
export async function getGmailConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  accountId: string,
): Promise<GmailConnection | null> {
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("is_active", true)
    .single();

  if (error && error.code !== "PGRST116") {
    consola.error("[gmail] Failed to get connection:", error);
    throw error;
  }

  return data as GmailConnection | null;
}

/**
 * Create or update Gmail connection from Pica AuthKit
 */
export async function upsertGmailConnection(
  supabase: SupabaseClient<Database>,
  connection: {
    user_id: string;
    account_id: string;
    pica_connection_id: string;
    pica_connection_key: string;
    email?: string | null;
  },
): Promise<GmailConnection> {
  const { data, error } = await supabase
    .from("gmail_connections")
    .upsert(
      {
        user_id: connection.user_id,
        account_id: connection.account_id,
        pica_connection_id: connection.pica_connection_id,
        pica_connection_key: connection.pica_connection_key,
        email: connection.email ?? null,
        is_active: true,
      },
      {
        onConflict: "user_id,account_id",
      },
    )
    .select()
    .single();

  if (error) {
    consola.error("[gmail] Failed to upsert connection:", error);
    throw error;
  }

  consola.info("[gmail] Connection saved", {
    userId: connection.user_id,
    accountId: connection.account_id,
    email: connection.email,
  });

  return data as GmailConnection;
}

/**
 * Delete (deactivate) Gmail connection
 */
export async function deleteGmailConnection(
  supabase: SupabaseClient<Database>,
  userId: string,
  accountId: string,
): Promise<void> {
  const { error } = await supabase
    .from("gmail_connections")
    .delete()
    .eq("user_id", userId)
    .eq("account_id", accountId);

  if (error) {
    consola.error("[gmail] Failed to delete connection:", error);
    throw error;
  }

  consola.info("[gmail] Connection deleted", { userId, accountId });
}

// -----------------------------------------------------------------------------
// Gmail Email Sending (via Pica Passthrough)
// -----------------------------------------------------------------------------

interface SendEmailParams {
  connectionKey: string;
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToMessageId?: string;
  threadId?: string;
}

interface SendEmailResult {
  messageId: string;
  threadId: string;
}

/**
 * Send an email via Gmail using Pica Passthrough API
 */
export async function sendGmailEmail(
  params: SendEmailParams,
): Promise<SendEmailResult> {
  // Build RFC 2822 email
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const toHeader = params.toName
    ? `"${params.toName}" <${params.to}>`
    : params.to;
  const fromHeader = params.fromName
    ? `"${params.fromName}" <${params.from}>`
    : params.from;
  const plainText = params.bodyText || stripHtml(params.bodyHtml);

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  // Add threading headers for follow-ups/nudges
  if (params.replyToMessageId) {
    headers.push(`In-Reply-To: ${params.replyToMessageId}`);
    headers.push(`References: ${params.replyToMessageId}`);
  }

  const body = [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    plainText,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    params.bodyHtml,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  // Base64url encode per Gmail API spec
  const encodedMessage = Buffer.from(body)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const requestBody: Record<string, string> = { raw: encodedMessage };
  if (params.threadId) {
    requestBody.threadId = params.threadId;
  }

  const response = await picaPassthrough<{ id: string; threadId: string }>(
    params.connectionKey,
    "gmail",
    {
      method: "POST",
      path: "/gmail/v1/users/me/messages/send",
      body: requestBody,
    },
  );

  consola.info("[gmail] Email sent", {
    to: params.to,
    subject: params.subject,
    messageId: response.data.id,
  });

  return {
    messageId: response.data.id,
    threadId: response.data.threadId,
  };
}

// -----------------------------------------------------------------------------
// Survey Send Operations
// -----------------------------------------------------------------------------

/**
 * Get survey send stats for a survey
 */
export async function getSurveySendStats(
  supabase: SupabaseClient<Database>,
  surveyId: string,
): Promise<{
  total: number;
  sent: number;
  opened: number;
  completed: number;
  pendingNudge: number;
} | null> {
  const { data, error } = await supabase
    .from("survey_sends")
    .select("status, nudge_enabled, next_nudge_at")
    .eq("survey_id", surveyId);

  if (error) {
    consola.error("[gmail] Failed to get survey send stats:", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const now = new Date();
  return {
    total: data.length,
    sent: data.filter((s) => s.status === "sent").length,
    opened: data.filter((s) => s.status === "opened").length,
    completed: data.filter((s) => s.status === "completed").length,
    pendingNudge: data.filter(
      (s) =>
        s.nudge_enabled &&
        s.status !== "completed" &&
        s.status !== "bounced" &&
        s.status !== "failed" &&
        s.next_nudge_at &&
        new Date(s.next_nudge_at) > now,
    ).length,
  };
}

/**
 * Get survey send stats for multiple surveys at once (for list views)
 */
export async function getBatchSurveySendStats(
  supabase: SupabaseClient<Database>,
  surveyIds: string[],
): Promise<
  Record<
    string,
    { total: number; sent: number; opened: number; completed: number }
  >
> {
  if (surveyIds.length === 0) return {};

  const { data, error } = await supabase
    .from("survey_sends")
    .select("survey_id, status")
    .in("survey_id", surveyIds);

  if (error) {
    consola.error("[gmail] Failed to get batch survey send stats:", error);
    return {};
  }

  if (!data || data.length === 0) return {};

  const result: Record<
    string,
    { total: number; sent: number; opened: number; completed: number }
  > = {};

  for (const row of data) {
    if (!result[row.survey_id]) {
      result[row.survey_id] = { total: 0, sent: 0, opened: 0, completed: 0 };
    }
    const stats = result[row.survey_id];
    stats.total++;
    if (row.status === "sent") stats.sent++;
    else if (row.status === "opened") stats.opened++;
    else if (row.status === "completed") stats.completed++;
  }

  return result;
}

/**
 * Get all sends for a survey (for the recipient table)
 */
export async function getSurveySends(
  supabase: SupabaseClient<Database>,
  surveyId: string,
): Promise<SurveySend[]> {
  const { data, error } = await supabase
    .from("survey_sends")
    .select("*")
    .eq("survey_id", surveyId)
    .order("sent_at", { ascending: false });

  if (error) {
    consola.error("[gmail] Failed to get survey sends:", error);
    throw error;
  }

  return (data ?? []) as SurveySend[];
}

/**
 * Create survey send records for a batch of recipients
 */
export async function createSurveySends(
  supabase: SupabaseClient<Database>,
  sends: Array<{
    account_id: string;
    project_id: string;
    survey_id: string;
    gmail_connection_id: string;
    person_id?: string | null;
    to_email: string;
    to_name?: string | null;
    subject: string;
    from_email: string;
    personalized_link?: string | null;
    gmail_message_id?: string | null;
    gmail_thread_id?: string | null;
  }>,
): Promise<SurveySend[]> {
  if (sends.length === 0) return [];

  // Calculate first nudge at Day 3
  const nudgeDelay = 3 * 24 * 60 * 60 * 1000; // 3 days in ms
  const nextNudgeAt = new Date(Date.now() + nudgeDelay).toISOString();

  const { data, error } = await supabase
    .from("survey_sends")
    .insert(
      sends.map((s) => ({
        ...s,
        person_id: s.person_id ?? null,
        to_name: s.to_name ?? null,
        personalized_link: s.personalized_link ?? null,
        gmail_message_id: s.gmail_message_id ?? null,
        gmail_thread_id: s.gmail_thread_id ?? null,
        status: "sent" as const,
        next_nudge_at: nextNudgeAt,
        nudge_enabled: true,
      })),
    )
    .select();

  if (error) {
    consola.error("[gmail] Failed to create survey sends:", error);
    throw error;
  }

  return (data ?? []) as SurveySend[];
}

/**
 * Mark a survey send as completed (called when survey response is received)
 */
export async function markSurveySendCompleted(
  supabase: SupabaseClient<Database>,
  surveyId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase
    .from("survey_sends")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      nudge_enabled: false,
      next_nudge_at: null,
    })
    .eq("survey_id", surveyId)
    .eq("to_email", email)
    .eq("status", "sent")
    .or("status.eq.opened");

  if (error && error.code !== "PGRST116") {
    consola.error("[gmail] Failed to mark send completed:", error);
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Strip HTML tags for plain text email fallback
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
