import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/../supabase/types"

let supabaseClient: SupabaseClient<Database> | undefined

/**
 * Creates a Supabase browser client with proper SSR support
 * This client maintains auth state and syncs with server-side sessions
 */
export function createClient(): SupabaseClient<Database> {
	// Return existing client if already created
	if (supabaseClient) {
		return supabaseClient
	}

	// Ensure we're in the browser
	if (typeof window === "undefined") {
		throw new Error("createClient should only be called on the client side")
	}

	// Use environment values from window.env (set in root loader)
	const supabaseUrl = window.env?.SUPABASE_URL
	const supabaseAnonKey = window.env?.SUPABASE_ANON_KEY

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in client environment")
	}

	// Create the client with proper cookie handling for SSR
	supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)

	return supabaseClient
}

/**
 * Gets the current Supabase client instance
 * Safe to call multiple times - returns the same instance
 */
export function getSupabaseClient(): SupabaseClient<Database> {
	return supabaseClient ?? createClient()
}
