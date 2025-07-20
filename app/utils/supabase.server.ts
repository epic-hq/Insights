import { createClient } from "@supabase/supabase-js"
import type { Database } from "../../supabase/types.ts"

// On the server we use the service role *anon* key for local dev.
// env already contains SUPABASE_URL and SUPABASE_ANON_KEY when running `supabase start`.
// For production you would inject secrets differently.

const supabaseUrl = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
// deno-lint-ignore no-undef
const anonKey = process.env.SUPABASE_ANON_KEY ?? ""
// deno-lint-ignore no-undef
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

/* Anonymous-like client (no session) */
export const supabaseAnon = createClient<Database>(supabaseUrl, anonKey, {
	auth: { persistSession: false },
})

/* Server-side admin client for privileged actions */
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceKey, {
	auth: { persistSession: false },
})

/* Per-request helper: returns client with user JWT set for RLS queries */
// Backward-compat: existing loaders may still import { db }
export const db = supabaseAnon

export function getRlsClient(jwt: string) {
	return createClient<Database>(supabaseUrl, anonKey, {
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${jwt}` },
		},
	})
}
