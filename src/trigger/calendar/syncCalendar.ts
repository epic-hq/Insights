/**
 * Calendar Sync Task
 *
 * Syncs calendar events from Google Calendar for a specific user connection.
 * Uses Pica Passthrough API for connections with pica_connection_key,
 * or falls back to direct API for legacy connections with stored tokens.
 */

import { schedules, schemaTask } from "@trigger.dev/sdk";
import consola from "consola";
import { z } from "zod";
import {
  type CalendarConnection,
  markSyncCompleted,
  markSyncFailed,
  upsertCalendarEvents,
} from "~/lib/integrations/calendar.server";
import {
  classifyMeeting,
  extractMeetingUrl,
  fetchCalendarEvents,
  fetchCalendarEventsDirect,
} from "~/lib/integrations/pica.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

export const syncCalendarTask = schemaTask({
  id: "calendar.sync",
  schema: z.object({
    connectionId: z.string().uuid(),
    daysAhead: z.number().min(1).max(30).default(14),
    daysBehind: z.number().min(0).max(7).default(1),
  }),
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload) => {
    const { connectionId, daysAhead, daysBehind } = payload;
    const db = createSupabaseAdminClient();

    consola.info(
      `[calendar.sync] Starting sync for connection: ${connectionId}`,
    );

    // 1. Load the calendar connection
    const { data: connection, error: connError } = await db
      .from("calendar_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const conn = connection as unknown as CalendarConnection;

    if (!conn.sync_enabled) {
      consola.info(
        `[calendar.sync] Sync disabled for connection: ${connectionId}`,
      );
      return { success: false, reason: "sync_disabled", eventCount: 0 };
    }

    // 2. Calculate time range
    const now = new Date();
    const timeMin = new Date(now.getTime() - daysBehind * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    // 3. Fetch calendar events - use Pica Passthrough if available, otherwise direct
    let googleEvents;
    try {
      if (conn.pica_connection_key) {
        // Use Pica Passthrough API
        consola.info(`[calendar.sync] Using Pica Passthrough API`);
        googleEvents = await fetchCalendarEvents({
          connectionKey: conn.pica_connection_key,
          calendarId: conn.calendar_id || "primary",
          timeMin,
          timeMax,
          maxResults: 250,
        });
      } else if (conn.access_token) {
        // Legacy: direct Google API with stored token
        consola.info(`[calendar.sync] Using direct Google API (legacy)`);
        googleEvents = await fetchCalendarEventsDirect({
          accessToken: conn.access_token,
          calendarId: conn.calendar_id || "primary",
          timeMin,
          timeMax,
          maxResults: 250,
        });
      } else {
        await markSyncFailed(
          db,
          connectionId,
          "No connection credentials available",
        );
        throw new Error(
          "Connection has neither pica_connection_key nor access_token",
        );
      }
    } catch (fetchError) {
      const errorMessage =
        fetchError instanceof Error
          ? fetchError.message
          : "Unknown fetch error";
      await markSyncFailed(db, connectionId, errorMessage);
      throw fetchError;
    }

    consola.info(
      `[calendar.sync] Fetched ${googleEvents.length} events from Google Calendar`,
    );

    // 4. Transform and classify events
    const userEmail = conn.provider_email || "";
    const events = googleEvents.map((event) => {
      const { isCustomerMeeting, meetingType } = classifyMeeting(
        event,
        userEmail,
      );

      return {
        account_id: conn.account_id,
        connection_id: conn.id,
        user_id: conn.user_id,
        external_id: event.id,
        title: event.summary || null,
        description: event.description || null,
        start_time: event.start.dateTime || event.start.date || "",
        end_time: event.end.dateTime || event.end.date || "",
        timezone: event.start.timeZone || null,
        location: event.location || null,
        meeting_url: extractMeetingUrl(event),
        attendee_emails: (event.attendees || []).map((a) => a.email),
        organizer_email: event.organizer?.email || null,
        is_customer_meeting: isCustomerMeeting,
        meeting_type: meetingType,
        raw_event: event,
      };
    });

    // 5. Upsert events to database
    if (events.length > 0) {
      await upsertCalendarEvents(db, events);
    }

    // 6. Mark sync as completed
    await markSyncCompleted(db, connectionId);

    const customerMeetings = events.filter((e) => e.is_customer_meeting).length;

    consola.success(
      `[calendar.sync] Sync completed for connection ${connectionId}: ${events.length} events (${customerMeetings} customer meetings)`,
    );

    return {
      success: true,
      eventCount: events.length,
      customerMeetingCount: customerMeetings,
      timeRange: {
        from: timeMin.toISOString(),
        to: timeMax.toISOString(),
      },
    };
  },
});

/**
 * Sync all active calendar connections
 * Runs on a schedule to keep calendars up to date
 */
export const syncAllCalendarsTask = schemaTask({
  id: "calendar.sync-all",
  schema: z.object({
    daysAhead: z.number().min(1).max(30).default(14),
    daysBehind: z.number().min(0).max(7).default(1),
  }),
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
  },
  run: async (payload) => {
    const { daysAhead, daysBehind } = payload;
    const db = createSupabaseAdminClient();

    consola.info(
      "[calendar.sync-all] Starting sync for all active connections",
    );

    // Fetch all active connections
    const { data: connections, error } = await db
      .from("calendar_connections")
      .select("id")
      .eq("sync_enabled", true);

    if (error) {
      throw new Error(`Failed to fetch connections: ${error.message}`);
    }

    if (!connections || connections.length === 0) {
      consola.info("[calendar.sync-all] No active connections to sync");
      return { success: true, connectionCount: 0, results: [] };
    }

    consola.info(
      `[calendar.sync-all] Found ${connections.length} active connections`,
    );

    // Trigger sync for each connection
    const results: Array<{
      connectionId: string;
      triggered: boolean;
      error?: string;
    }> = [];

    for (const conn of connections) {
      try {
        await syncCalendarTask.trigger({
          connectionId: conn.id,
          daysAhead,
          daysBehind,
        });
        results.push({ connectionId: conn.id, triggered: true });
      } catch (triggerError) {
        const errorMessage =
          triggerError instanceof Error
            ? triggerError.message
            : "Unknown error";
        consola.error(
          `[calendar.sync-all] Failed to trigger sync for ${conn.id}:`,
          errorMessage,
        );
        results.push({
          connectionId: conn.id,
          triggered: false,
          error: errorMessage,
        });
      }
    }

    const successCount = results.filter((r) => r.triggered).length;

    consola.success(
      `[calendar.sync-all] Triggered ${successCount}/${connections.length} sync tasks`,
    );

    return {
      success: true,
      connectionCount: connections.length,
      triggeredCount: successCount,
      results,
    };
  },
});

/**
 * Hourly scheduled task to sync all active calendar connections
 * Runs at the top of every hour
 */
export const hourlyCalendarSync = schedules.task({
  id: "calendar.sync-hourly",
  cron: "0 * * * *", // Every hour at minute 0
  run: async () => {
    consola.info("[calendar.sync-hourly] Starting hourly calendar sync");

    const handle = await syncAllCalendarsTask.trigger({
      daysAhead: 14,
      daysBehind: 1,
    });

    consola.info("[calendar.sync-hourly] Triggered sync-all task", {
      taskId: handle.id,
    });

    return {
      triggered: true,
      taskId: handle.id,
    };
  },
});
