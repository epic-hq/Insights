import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"
import { getServerEnv } from "~/env.server"
import type { Database } from "~/types"

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: _SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()

export const getServerClient = (request: Request) => {
	const headers = new Headers()
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get("Cookie") ?? "") as {
					name: string
					value: string
				}[]
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					headers.append("Set-Cookie", serializeCookieHeader(name, value, options))
				})
			},
		},
	})

	return { client: supabase, headers }
}

export function createSupabaseAdminClient() {
	return createServerClient<Database>(SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY, {
		cookies: {
			getAll: () => [],
			setAll: () => { },
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
		// Prefer JWT claims when available
		const { data: claims, error } = await supabase.client.auth.getClaims()
		// consola.log("getAuthenticatedUser claims", claims)
		if (claims?.claims && !error) {
			return claims.claims as any
		}
		// Fallback to user/session for broader compatibility
		const { data: sessionData } = await supabase.client.auth.getSession()
		if (sessionData?.session?.user) {
			const u = sessionData.session.user
			return {
				sub: u.id,
				email: u.email,
				user_metadata: u.user_metadata,
				app_metadata: u.app_metadata,
				// not strictly claims, but useful in callers that look for tokens
				access_token: sessionData.session.access_token,
			}
		}
		return null
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
		setAll: () => { },
	},
	auth: { persistSession: false },
})

// Per-request helper that returns a client with a user JWT set for RLS-protected queries
export function getRlsClient(jwt: string) {
	return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => [],
			setAll: () => { },
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
