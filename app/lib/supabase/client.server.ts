import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr"
import { getServerEnv } from "~/env.server"
import type { Database } from "~/types"

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: _SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()

export const getServerClient = (request: Request) => {
	const headers = new Headers()
	const requestUrl = new URL(request.url)
	// Use x-forwarded-host (from reverse proxy) or host header to get the actual hostname
	// request.url contains internal hostname (localhost/0.0.0.0) when behind Fly.io/proxies
	const actualHost =
		request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.hostname
	const isProduction = actualHost === "getupsight.com" || actualHost.endsWith(".getupsight.com")

	const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get("Cookie") ?? "") as {
					name: string
					value: string
				}[]
			},
			setAll(cookiesToSet) {
				cookiesToSet.forEach(({ name, value, options }) => {
					// Configure cookie options for OAuth flow compatibility
					const cookieOptions = {
						...options,
						// SameSite=Lax allows cookies to be sent on top-level navigation (OAuth redirects)
						sameSite: "lax" as const,
						// Secure must be true in production for SameSite to work properly
						secure: isProduction,
						// Ensure cookie is accessible across the entire domain
						path: options?.path ?? "/",
						// Set reasonable maxAge if not specified (7 days)
						maxAge: options?.maxAge ?? 60 * 60 * 24 * 7,
					}
					headers.append("Set-Cookie", serializeCookieHeader(name, value, cookieOptions))
				})
			},
		},
		auth: {
			// Explicitly use PKCE flow for OAuth (more secure and reliable)
			flowType: "pkce",
		},
	})

	return { client: supabase, headers }
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
 * Also returns headers that should be included in the response (for token refresh)
 */
export async function getAuthenticatedUser(request: Request) {
	const { client: supabase, headers } = getServerClient(request)

	try {
		// Prefer JWT claims when available
		const { data: claims, error } = await supabase.auth.getClaims()
		// consola.log("getAuthenticatedUser claims", claims)
		if (claims?.claims && !error) {
			return { user: claims.claims as any, headers }
		}
		// Fallback to user/session for broader compatibility
		const { data: sessionData } = await supabase.auth.getSession()
		if (sessionData?.session?.user) {
			const u = sessionData.session.user
			return {
				user: {
					sub: u.id,
					email: u.email,
					user_metadata: u.user_metadata,
					app_metadata: u.app_metadata,
					// not strictly claims, but useful in callers that look for tokens
					access_token: sessionData.session.access_token,
				},
				headers,
			}
		}
		return { user: null, headers }
	} catch {
		return { user: null, headers }
	}
}

/**
 * Legacy function that only returns user (for backward compatibility)
 * @deprecated Use getAuthenticatedUser and handle headers properly
 */
export async function getAuthenticatedUserOnly(request: Request) {
	const result = await getAuthenticatedUser(request)
	return result.user
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
