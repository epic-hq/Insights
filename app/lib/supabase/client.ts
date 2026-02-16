import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/../supabase/types";

let supabaseClient: SupabaseClient<Database> | undefined;
let ssrFallbackClient: SupabaseClient<Database> | undefined;
let hasLoggedSsrFallback = false;

/**
 * Creates a Supabase browser client with proper SSR support
 * This client maintains auth state and syncs with server-side sessions
 */
export function createClient(): SupabaseClient<Database> {
	// Return existing client if already created
	if (supabaseClient) {
		return supabaseClient;
	}

	// Server-side fallback: avoid crashing SSR when a client-only hook/component
	// accidentally initializes Supabase during render.
	if (typeof window === "undefined") {
		if (ssrFallbackClient) {
			return ssrFallbackClient;
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

		if (!supabaseUrl || !supabaseAnonKey) {
			throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in server environment");
		}

		if (!hasLoggedSsrFallback) {
			hasLoggedSsrFallback = true;
			console.warn(
				"[supabase/client] createClient() called during SSR; using anon fallback client. Move calls behind client guards where possible."
			);
		}

		ssrFallbackClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
				detectSessionInUrl: false,
			},
		});

		return ssrFallbackClient;
	}

	// Use environment values from window.env (set in root loader)
	const supabaseUrl = window.env?.SUPABASE_URL;
	const supabaseAnonKey = window.env?.SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in client environment");
	}

	// Create the client with proper cookie handling for SSR and PKCE flow
	supabaseClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
		auth: {
			// Use PKCE flow for OAuth (more secure and reliable for cross-domain auth)
			flowType: "pkce",
			// Detect session changes across tabs and in URL params
			detectSessionInUrl: true,
		},
	});

	return supabaseClient;
}

/**
 * Gets the current Supabase client instance
 * Safe to call multiple times - returns the same instance
 */
export function getSupabaseClient(): SupabaseClient<Database> {
	return supabaseClient ?? createClient();
}
