import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { useRouteLoaderData } from "react-router"
import type { Env } from "~/+types/root"
import type { Database } from "../../../supabase/types"

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
	const supabaseUrl = clientEnv?.SUPABASE_URL || "http://127.0.0.1:54321"
	const supabaseAnonKey = clientEnv?.SUPABASE_ANON_KEY

	consola.log("client: createClientBrowser", supabaseUrl)

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
