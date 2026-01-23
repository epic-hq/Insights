/**
 * Calendar Integration Database Operations
 *
 * Handles CRUD operations for calendar connections and events.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"

// -----------------------------------------------------------------------------
// Calendar Connection Operations
// -----------------------------------------------------------------------------

export interface CalendarConnection {
	id: string
	user_id: string
	account_id: string
	provider: "google" | "outlook"
	provider_account_id: string | null
	provider_email: string | null
	// OAuth tokens (legacy direct connections)
	access_token: string | null
	refresh_token: string | null
	token_expires_at: string | null
	// Pica AuthKit connection (preferred)
	pica_connection_id: string | null
	pica_connection_key: string | null
	calendar_id: string
	sync_enabled: boolean
	last_synced_at: string | null
	sync_error: string | null
	created_at: string
	updated_at: string
}

/**
 * Get user's calendar connection
 */
export async function getCalendarConnection(
	supabase: SupabaseClient<Database>,
	userId: string,
	provider: "google" | "outlook" = "google"
): Promise<CalendarConnection | null> {
	const { data, error } = await supabase
		.from("calendar_connections")
		.select("*")
		.eq("user_id", userId)
		.eq("provider", provider)
		.single()

	if (error && error.code !== "PGRST116") {
		consola.error("[calendar] Failed to get connection:", error)
		throw error
	}

	return data as CalendarConnection | null
}

/**
 * Create or update calendar connection
 */
export async function upsertCalendarConnection(
	supabase: SupabaseClient<Database>,
	connection: {
		user_id: string
		account_id: string
		provider: "google" | "outlook"
		provider_account_id?: string | null
		provider_email?: string | null
		access_token: string
		refresh_token?: string | null
		token_expires_at?: string | null
		calendar_id?: string
	}
): Promise<CalendarConnection> {
	const { data, error } = await supabase
		.from("calendar_connections")
		.upsert(
			{
				user_id: connection.user_id,
				account_id: connection.account_id,
				provider: connection.provider,
				provider_account_id: connection.provider_account_id ?? null,
				provider_email: connection.provider_email ?? null,
				access_token: connection.access_token,
				refresh_token: connection.refresh_token ?? null,
				token_expires_at: connection.token_expires_at ?? null,
				calendar_id: connection.calendar_id ?? "primary",
				sync_enabled: true,
				sync_error: null,
			},
			{
				onConflict: "user_id,provider",
			}
		)
		.select()
		.single()

	if (error) {
		consola.error("[calendar] Failed to upsert connection:", error)
		throw error
	}

	consola.info("[calendar] Connection saved", {
		userId: connection.user_id,
		provider: connection.provider,
		email: connection.provider_email,
	})

	return data as CalendarConnection
}

/**
 * Update connection tokens (for refresh)
 */
export async function updateConnectionTokens(
	supabase: SupabaseClient<Database>,
	connectionId: string,
	tokens: {
		access_token: string
		token_expires_at?: string | null
	}
): Promise<void> {
	const { error } = await supabase
		.from("calendar_connections")
		.update({
			access_token: tokens.access_token,
			token_expires_at: tokens.token_expires_at ?? null,
			sync_error: null,
		})
		.eq("id", connectionId)

	if (error) {
		consola.error("[calendar] Failed to update tokens:", error)
		throw error
	}
}

/**
 * Mark sync as completed
 */
export async function markSyncCompleted(supabase: SupabaseClient<Database>, connectionId: string): Promise<void> {
	const { error } = await supabase
		.from("calendar_connections")
		.update({
			last_synced_at: new Date().toISOString(),
			sync_error: null,
		})
		.eq("id", connectionId)

	if (error) {
		consola.error("[calendar] Failed to mark sync completed:", error)
		throw error
	}
}

/**
 * Mark sync as failed
 */
export async function markSyncFailed(
	supabase: SupabaseClient<Database>,
	connectionId: string,
	errorMessage: string
): Promise<void> {
	const { error } = await supabase
		.from("calendar_connections")
		.update({
			sync_error: errorMessage,
		})
		.eq("id", connectionId)

	if (error) {
		consola.error("[calendar] Failed to mark sync failed:", error)
		throw error
	}
}

/**
 * Delete calendar connection
 */
export async function deleteCalendarConnection(
	supabase: SupabaseClient<Database>,
	userId: string,
	provider: "google" | "outlook" = "google"
): Promise<void> {
	const { error } = await supabase.from("calendar_connections").delete().eq("user_id", userId).eq("provider", provider)

	if (error) {
		consola.error("[calendar] Failed to delete connection:", error)
		throw error
	}

	consola.info("[calendar] Connection deleted", { userId, provider })
}

// -----------------------------------------------------------------------------
// Calendar Event Operations
// -----------------------------------------------------------------------------

export interface CalendarEvent {
	id: string
	account_id: string
	connection_id: string
	user_id: string
	external_id: string
	title: string | null
	description: string | null
	start_time: string
	end_time: string
	timezone: string | null
	location: string | null
	meeting_url: string | null
	attendee_emails: string[]
	organizer_email: string | null
	is_customer_meeting: boolean
	meeting_type: "customer" | "internal" | "unknown" | null
	matched_person_ids: string[]
	matched_org_id: string | null
	brief_generated_at: string | null
	brief_id: string | null
	interview_id: string | null
	synced_at: string
	created_at: string
	updated_at: string
}

/**
 * Upsert calendar events (from sync)
 */
export async function upsertCalendarEvents(
	supabase: SupabaseClient<Database>,
	events: Array<{
		account_id: string
		connection_id: string
		user_id: string
		external_id: string
		title?: string | null
		description?: string | null
		start_time: string
		end_time: string
		timezone?: string | null
		location?: string | null
		meeting_url?: string | null
		attendee_emails?: string[]
		organizer_email?: string | null
		is_customer_meeting?: boolean
		meeting_type?: "customer" | "internal" | "unknown"
		raw_event?: unknown
	}>
): Promise<void> {
	if (events.length === 0) return

	const { error } = await supabase.from("calendar_events").upsert(
		events.map((e) => ({
			account_id: e.account_id,
			connection_id: e.connection_id,
			user_id: e.user_id,
			external_id: e.external_id,
			title: e.title ?? null,
			description: e.description ?? null,
			start_time: e.start_time,
			end_time: e.end_time,
			timezone: e.timezone ?? null,
			location: e.location ?? null,
			meeting_url: e.meeting_url ?? null,
			attendee_emails: e.attendee_emails ?? [],
			organizer_email: e.organizer_email ?? null,
			is_customer_meeting: e.is_customer_meeting ?? false,
			meeting_type: e.meeting_type ?? "unknown",
			synced_at: new Date().toISOString(),
			raw_event: e.raw_event ?? null,
		})),
		{
			onConflict: "connection_id,external_id",
		}
	)

	if (error) {
		consola.error("[calendar] Failed to upsert events:", error)
		throw error
	}

	consola.info("[calendar] Events synced", { count: events.length })
}

/**
 * Get upcoming events for a user
 */
export async function getUpcomingEvents(
	supabase: SupabaseClient<Database>,
	params: {
		accountId: string
		userId?: string
		daysAhead?: number
		customerOnly?: boolean
		limit?: number
	}
): Promise<CalendarEvent[]> {
	const daysAhead = params.daysAhead ?? 7
	const limit = params.limit ?? 50

	const now = new Date()
	const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

	let query = supabase
		.from("calendar_events")
		.select("*")
		.eq("account_id", params.accountId)
		.gte("start_time", now.toISOString())
		.lte("start_time", futureDate.toISOString())
		.order("start_time", { ascending: true })
		.limit(limit)

	if (params.userId) {
		query = query.eq("user_id", params.userId)
	}

	if (params.customerOnly) {
		query = query.eq("is_customer_meeting", true)
	}

	const { data, error } = await query

	if (error) {
		consola.error("[calendar] Failed to get upcoming events:", error)
		throw error
	}

	return (data ?? []) as CalendarEvent[]
}

/**
 * Get a single calendar event by ID
 */
export async function getCalendarEvent(
	supabase: SupabaseClient<Database>,
	eventId: string
): Promise<CalendarEvent | null> {
	const { data, error } = await supabase.from("calendar_events").select("*").eq("id", eventId).single()

	if (error && error.code !== "PGRST116") {
		consola.error("[calendar] Failed to get event:", error)
		throw error
	}

	return data as CalendarEvent | null
}
