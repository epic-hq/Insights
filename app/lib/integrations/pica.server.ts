/**
 * Pica Integration Client
 *
 * Handles OAuth connections to Google Calendar (and future integrations) via Pica.
 * @see https://picaos.com/docs
 */

import consola from "consola";

// Environment variables
const PICA_API_KEY = process.env.PICA_API_KEY;
const PICA_API_URL = process.env.PICA_API_URL || "https://api.picaos.com";

if (!PICA_API_KEY) {
  consola.warn("[pica] PICA_API_KEY not set - calendar integration disabled");
}

/**
 * Check if Pica integration is configured
 */
export function isPicaConfigured(): boolean {
  return Boolean(PICA_API_KEY);
}

/**
 * Generate OAuth authorization URL for Google Calendar
 */
export async function getGoogleCalendarAuthUrl(params: {
  userId: string;
  accountId: string;
  redirectUri: string;
}): Promise<string> {
  if (!PICA_API_KEY) {
    throw new Error("Pica API key not configured");
  }

  const response = await fetch(
    `${PICA_API_URL}/v1/connections/google-calendar/authorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PICA_API_KEY}`,
      },
      body: JSON.stringify({
        redirect_uri: params.redirectUri,
        state: JSON.stringify({
          user_id: params.userId,
          account_id: params.accountId,
        }),
        scopes: [
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/calendar.events.readonly",
        ],
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    consola.error("[pica] Failed to get auth URL:", error);
    throw new Error("Failed to initiate Google Calendar connection");
  }

  const data = await response.json();
  return data.authorization_url;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  email: string | null;
  provider_account_id: string | null;
}> {
  if (!PICA_API_KEY) {
    throw new Error("Pica API key not configured");
  }

  const response = await fetch(
    `${PICA_API_URL}/v1/connections/google-calendar/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PICA_API_KEY}`,
      },
      body: JSON.stringify({
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    consola.error("[pica] Failed to exchange code:", error);
    throw new Error("Failed to complete Google Calendar connection");
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_at: data.expires_at || null,
    email: data.email || null,
    provider_account_id: data.provider_account_id || null,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_at: string | null;
}> {
  if (!PICA_API_KEY) {
    throw new Error("Pica API key not configured");
  }

  const response = await fetch(
    `${PICA_API_URL}/v1/connections/google-calendar/refresh`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PICA_API_KEY}`,
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    consola.error("[pica] Failed to refresh token:", error);
    throw new Error("Failed to refresh calendar access");
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    expires_at: data.expires_at || null,
  };
}

/**
 * Revoke calendar connection
 */
export async function revokeConnection(accessToken: string): Promise<void> {
  if (!PICA_API_KEY) {
    throw new Error("Pica API key not configured");
  }

  try {
    await fetch(`${PICA_API_URL}/v1/connections/google-calendar/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PICA_API_KEY}`,
      },
      body: JSON.stringify({
        access_token: accessToken,
      }),
    });
  } catch (error) {
    consola.warn("[pica] Failed to revoke connection:", error);
    // Don't throw - we'll delete from our DB anyway
  }
}

// -----------------------------------------------------------------------------
// Google Calendar API (using stored tokens)
// -----------------------------------------------------------------------------

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    responseStatus?: string;
  }>;
  organizer?: { email: string; displayName?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
    }>;
  };
}

interface GoogleCalendarListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

/**
 * Fetch calendar events from Google Calendar API
 */
export async function fetchCalendarEvents(params: {
  accessToken: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
}): Promise<GoogleCalendarEvent[]> {
  const calendarId = params.calendarId || "primary";
  const maxResults = params.maxResults || 100;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", params.timeMin.toISOString());
  url.searchParams.set("timeMax", params.timeMax.toISOString());
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    consola.error("[pica] Failed to fetch calendar events:", error);
    throw new Error("Failed to fetch calendar events");
  }

  const data: GoogleCalendarListResponse = await response.json();
  return data.items || [];
}

/**
 * Extract meeting URL from event
 */
export function extractMeetingUrl(event: GoogleCalendarEvent): string | null {
  // Check hangout link first
  if (event.hangoutLink) {
    return event.hangoutLink;
  }

  // Check conference data
  if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (e) => e.entryPointType === "video",
    );
    if (videoEntry?.uri) {
      return videoEntry.uri;
    }
  }

  // Check location for common meeting URLs
  if (event.location) {
    const meetingPatterns = [
      /https:\/\/[\w.-]*zoom\.us\/[^\s]+/i,
      /https:\/\/meet\.google\.com\/[^\s]+/i,
      /https:\/\/teams\.microsoft\.com\/[^\s]+/i,
    ];

    for (const pattern of meetingPatterns) {
      const match = event.location.match(pattern);
      if (match) {
        return match[0];
      }
    }
  }

  return null;
}

/**
 * Determine if event is likely a customer meeting
 */
export function classifyMeeting(
  event: GoogleCalendarEvent,
  userEmail: string,
  companyDomain?: string,
): {
  isCustomerMeeting: boolean;
  meetingType: "customer" | "internal" | "unknown";
} {
  const attendees = event.attendees || [];

  // Extract company domain from user email if not provided
  const domain = companyDomain || userEmail.split("@")[1];

  // Check for external attendees
  const hasExternalAttendee = attendees.some((a) => {
    if (a.self) return false;
    const attendeeDomain = a.email.split("@")[1];
    return attendeeDomain !== domain;
  });

  if (hasExternalAttendee) {
    return { isCustomerMeeting: true, meetingType: "customer" };
  }

  // All attendees are internal
  if (attendees.length > 0) {
    return { isCustomerMeeting: false, meetingType: "internal" };
  }

  // No attendees - unknown
  return { isCustomerMeeting: false, meetingType: "unknown" };
}
