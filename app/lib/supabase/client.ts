import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useRouteLoaderData } from "react-router"
import type { Env } from "~/../+types"
import type { Database } from "~/../supabase/types"

let supabaseClient: SupabaseClient<Database> | undefined

/**
 * Creates a Supabase browser client with proper SSR support
 * This client maintains auth state and syncs with server-side sessions
 */
export function createClient(): SupabaseClient<Database> {
	const { clientEnv } = useRouteLoaderData("root") as { clientEnv: Env }

	// Ensure we're in the browser
	if (typeof window === "undefined") {
		throw new Error("createClient should only be called on the client side")
	}

	// Access environment variables from loader
	const supabaseUrl = clientEnv?.SUPABASE_URL || "SUPABASE_URL=https://rbginqvgkonnoktrttqv.supabase.co"
	const supabaseAnonKey = clientEnv?.SUPABASE_ANON_KEY || "sb_publishable_Tkem8wKHHZSJqyZjMaLpCQ_S2io_bXY"
	// consola.log("supabaseUrl", supabaseUrl)
	// consola.log("supabaseAnonKey", supabaseAnonKey)
	if (!supabaseAnonKey) {
		throw new Error("Missing SUPABASE_ANON_KEY environment variable")
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
