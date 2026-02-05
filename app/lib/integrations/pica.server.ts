/**
 * Pica Integration Client
 *
 * Uses Pica's Passthrough API to make authenticated API calls through stored connections.
 * OAuth is handled by AuthKit on the frontend - this file only handles API calls.
 * @see https://docs.picaos.com
 */

import consola from "consola"

// Environment variables
const PICA_SECRET_KEY = process.env.PICA_SECRET_KEY || process.env.PICA_API_KEY
const PICA_API_URL = process.env.PICA_API_URL || "https://api.picaos.com"

if (!PICA_SECRET_KEY) {
	consola.warn("[pica] PICA_SECRET_KEY not set - calendar integration disabled")
}

/**
 * Check if Pica integration is configured
 */
export function isPicaConfigured(): boolean {
	return Boolean(PICA_SECRET_KEY)
}

// -----------------------------------------------------------------------------
// Pica Passthrough API
// -----------------------------------------------------------------------------

interface PassthroughRequest {
	method: string
	path: string
	headers?: Record<string, string>
	body?: unknown
	queryParams?: Record<string, string>
}

interface PassthroughResponse<T = unknown> {
	status: number
	headers: Record<string, string>
	data: T
}

/**
 * Make an API call through Pica's Passthrough API
 * @see https://docs.picaos.com/passthrough-api
 */
export async function picaPassthrough<T = unknown>(
	connectionKey: string,
	platform: string,
	request: PassthroughRequest
): Promise<PassthroughResponse<T>> {
	if (!PICA_SECRET_KEY) {
		throw new Error("Pica secret key not configured")
	}

	const response = await fetch(`${PICA_API_URL}/v1/passthrough`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-pica-secret": PICA_SECRET_KEY,
			"x-pica-connection-key": connectionKey,
		},
		body: JSON.stringify({
			platform,
			...request,
		}),
	})

	if (!response.ok) {
		const error = await response.text()
		consola.error("[pica] Passthrough API error:", error)
		throw new Error(`Pica passthrough failed: ${response.status}`)
	}

	return response.json()
}

// -----------------------------------------------------------------------------
// Google Calendar API (via Passthrough)
// -----------------------------------------------------------------------------

interface GoogleCalendarEvent {
	id: string
	summary?: string
	description?: string
	start: { dateTime?: string; date?: string; timeZone?: string }
	end: { dateTime?: string; date?: string; timeZone?: string }
	location?: string
	attendees?: Array<{
		email: string
		displayName?: string
		organizer?: boolean
		self?: boolean
		responseStatus?: string
	}>
	organizer?: { email: string; displayName?: string }
	hangoutLink?: string
	conferenceData?: {
		entryPoints?: Array<{
			entryPointType: string
			uri: string
		}>
	}
}

interface GoogleCalendarListResponse {
	items: GoogleCalendarEvent[]
	nextPageToken?: string
}

/**
 * Fetch calendar events using Pica Passthrough API
 */
export async function fetchCalendarEvents(params: {
	connectionKey: string
	calendarId?: string
	timeMin: Date
	timeMax: Date
	maxResults?: number
}): Promise<GoogleCalendarEvent[]> {
	const calendarId = params.calendarId || "primary"
	const maxResults = params.maxResults || 100

	// Build query params for Google Calendar API
	const queryParams = {
		timeMin: params.timeMin.toISOString(),
		timeMax: params.timeMax.toISOString(),
		maxResults: String(maxResults),
		singleEvents: "true",
		orderBy: "startTime",
	}

	const response = await picaPassthrough<GoogleCalendarListResponse>(params.connectionKey, "google-calendar", {
		method: "GET",
		path: `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
		queryParams,
	})

	return response.data.items || []
}

/**
 * Fetch calendar events using direct Google API (legacy - for connections with stored tokens)
 * @deprecated Use fetchCalendarEvents with connectionKey instead
 */
export async function fetchCalendarEventsDirect(params: {
	accessToken: string
	calendarId?: string
	timeMin: Date
	timeMax: Date
	maxResults?: number
}): Promise<GoogleCalendarEvent[]> {
	const calendarId = params.calendarId || "primary"
	const maxResults = params.maxResults || 100

	const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
	url.searchParams.set("timeMin", params.timeMin.toISOString())
	url.searchParams.set("timeMax", params.timeMax.toISOString())
	url.searchParams.set("maxResults", String(maxResults))
	url.searchParams.set("singleEvents", "true")
	url.searchParams.set("orderBy", "startTime")

	const response = await fetch(url.toString(), {
		headers: {
			Authorization: `Bearer ${params.accessToken}`,
		},
	})

	if (!response.ok) {
		const error = await response.text()
		consola.error("[pica] Failed to fetch calendar events:", error)
		throw new Error("Failed to fetch calendar events")
	}

	const data: GoogleCalendarListResponse = await response.json()
	return data.items || []
}

/**
 * Extract meeting URL from event
 */
export function extractMeetingUrl(event: GoogleCalendarEvent): string | null {
	// Check hangout link first
	if (event.hangoutLink) {
		return event.hangoutLink
	}

	// Check conference data
	if (event.conferenceData?.entryPoints) {
		const videoEntry = event.conferenceData.entryPoints.find((e) => e.entryPointType === "video")
		if (videoEntry?.uri) {
			return videoEntry.uri
		}
	}

	// Check location for common meeting URLs
	if (event.location) {
		const meetingPatterns = [
			/https:\/\/[\w.-]*zoom\.us\/[^\s]+/i,
			/https:\/\/meet\.google\.com\/[^\s]+/i,
			/https:\/\/teams\.microsoft\.com\/[^\s]+/i,
		]

		for (const pattern of meetingPatterns) {
			const match = event.location.match(pattern)
			if (match) {
				return match[0]
			}
		}
	}

	return null
}

/**
 * Determine if event is likely a customer meeting
 */
export function classifyMeeting(
	event: GoogleCalendarEvent,
	userEmail: string,
	companyDomain?: string
): {
	isCustomerMeeting: boolean
	meetingType: "customer" | "internal" | "unknown"
} {
	const attendees = event.attendees || []

	// Extract company domain from user email if not provided
	const domain = companyDomain || userEmail.split("@")[1]

	// Check for external attendees
	const hasExternalAttendee = attendees.some((a) => {
		if (a.self) return false
		const attendeeDomain = a.email.split("@")[1]
		return attendeeDomain !== domain
	})

	if (hasExternalAttendee) {
		return { isCustomerMeeting: true, meetingType: "customer" }
	}

	// All attendees are internal
	if (attendees.length > 0) {
		return { isCustomerMeeting: false, meetingType: "internal" }
	}

	// No attendees - unknown
	return { isCustomerMeeting: false, meetingType: "unknown" }
}
