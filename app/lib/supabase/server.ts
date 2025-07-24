import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"
import type { Database } from "~/../supabase/types"

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ""
const _SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

export const getServerClient = (request: Request) => {
	const headers = new Headers()
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get("Cookie") ?? "") ?? {}
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) =>
					headers.append("Set-Cookie", serializeCookieHeader(name, value, options))
				)
			},
		},
	})

	return { client: supabase, headers: headers }
}

export function createSupabaseAdminClient() {
	return createServerClient<Database>(SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY, {
		cookies: {
			getAll: () => [],
			setAll: () => {},
		},
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	})
}

/**
 * Gets the authenticated user from the server-side request
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(request: Request) {
	const supabase = getServerClient(request)

	try {
		const { data: claims, error } = await supabase.client.auth.getClaims()
		if (error || !claims) {
			return null
		}
		return claims.claims
	} catch {
		return null
	}
}

/**
 * Gets the current session from the server-side request
 * Returns null if no valid session
 */
export async function getSession(request: Request) {
	const supabase = getServerClient(request)

	try {
		const {
			data: { session },
			error,
		} = await supabase.client.auth.getSession()
		if (error || !session) {
			return null
		}
		return session
	} catch {
		return null
	}
}

// Anonymous client (no cookies) for server-side actions without user context
export const supabaseAnon = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
	cookies: {
		getAll: () => [],
		setAll: () => {},
	},
	auth: { persistSession: false },
})

// Per-request helper that returns a client with a user JWT set for RLS-protected queries
export function getRlsClient(jwt: string) {
	return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => [],
			setAll: () => {},
		},
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${jwt}` },
		},
	})
}

// Backward compatibility exports
export const supabaseAdmin = createSupabaseAdminClient()
export { supabaseAnon as db }
