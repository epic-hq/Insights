import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../supabase/types"

export function createClient(): SupabaseClient<Database> | null {
	// Ensure we're in the browser before accessing window.env
	if (typeof window === "undefined") {
		// Return null for SSR - components should handle this gracefully
		return null
	}

	// Access environment variables from window.env (set in root.tsx)
	const env = (window as any).env
	const supabaseUrl = env?.SUPABASE_URL || "http://127.0.0.1:54321"
	const supabaseAnonKey = env?.SUPABASE_ANON_KEY

	if (!supabaseAnonKey) {
		// Use console.warn instead of console.error to avoid lint error
		return null
	}

	return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
}
