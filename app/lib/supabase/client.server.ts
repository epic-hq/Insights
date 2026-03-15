import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { getServerEnv } from "../../env.server";
import type { Database } from "../../types";
import type { AuthClaims } from "../../server/user-context";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: _SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

export const getServerClient = (request: Request) => {
	const headers = new Headers();
	const requestUrl = new URL(request.url);
	// Use x-forwarded-host (from reverse proxy) or host header to get the actual hostname
	// request.url contains internal hostname (localhost/0.0.0.0) when behind Fly.io/proxies
	const actualHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.hostname;
	const isProduction = actualHost === "getupsight.com" || actualHost.endsWith(".getupsight.com");

	const supabase = createServerClient<Database, "public">(SUPABASE_URL, SUPABASE_ANON_KEY, {
		db: { schema: "public" },
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get("Cookie") ?? "") as {
					name: string;
					value: string;
				}[];
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
					};
					headers.append("Set-Cookie", serializeCookieHeader(name, value, cookieOptions));
				});
			},
		},
		auth: {
			// Explicitly use PKCE flow for OAuth (more secure and reliable)
			flowType: "pkce",
		},
	});

	return { client: supabase, headers };
};

function extractBearerToken(request: Request): string | null {
	const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
	if (!authHeader) return null;
	if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
	const token = authHeader.slice(7).trim();
	return token.length > 0 ? token : null;
}

function normalizeAuthClaims(value: unknown, accessToken?: string | null): AuthClaims | null {
	if (!value || typeof value !== "object") return null;

	const claims = value as Record<string, unknown>;
	if (typeof claims.sub !== "string" || claims.sub.length === 0) {
		return null;
	}

	const email = typeof claims.email === "string" ? claims.email : null;
	const user_metadata =
		claims.user_metadata && typeof claims.user_metadata === "object"
			? (claims.user_metadata as AuthClaims["user_metadata"])
			: undefined;
	const app_metadata =
		claims.app_metadata && typeof claims.app_metadata === "object"
			? (claims.app_metadata as Record<string, unknown>)
			: null;

	return {
		...claims,
		sub: claims.sub,
		email,
		user_metadata,
		app_metadata,
		jwt: typeof claims.jwt === "string" ? claims.jwt : accessToken ?? null,
		access_token:
			typeof claims.access_token === "string" ? claims.access_token : typeof accessToken === "string" ? accessToken : null,
	};
}

export function createSupabaseAdminClient() {
	return createServerClient<Database, "public">(SUPABASE_URL, _SUPABASE_SERVICE_ROLE_KEY, {
		db: { schema: "public" },
		cookies: {
			getAll: () => [],
			setAll: () => {},
		},
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

/**
 * Gets the authenticated user from the server-side request
 * Returns null if not authenticated
 * Also returns headers that should be included in the response (for token refresh)
 */
export async function getAuthenticatedUser(request: Request) {
	const bearerToken = extractBearerToken(request);
	if (bearerToken) {
		try {
			const supabaseBearer = getRlsClient(bearerToken);
				const { data: claimsData, error: claimsError } = await supabaseBearer.auth.getClaims();
				if (claimsData?.claims && !claimsError) {
					const normalizedClaims = normalizeAuthClaims(claimsData.claims, bearerToken);
					if (!normalizedClaims) {
						return { user: null, headers: new Headers() };
					}
					return {
						user: normalizedClaims,
						headers: new Headers(),
					};
				}

			const {
				data: { user: bearerUser },
				error: userError,
			} = await supabaseBearer.auth.getUser();
			if (!userError && bearerUser) {
				return {
					user: {
						sub: bearerUser.id,
						email: bearerUser.email,
						user_metadata: bearerUser.user_metadata,
						app_metadata: bearerUser.app_metadata,
						jwt: bearerToken,
						access_token: bearerToken,
					},
					headers: new Headers(),
				};
			}
		} catch {
			// Fall through to cookie-based auth
		}
	}

	const { client: supabase, headers } = getServerClient(request);

	try {
		// Prefer JWT claims when available
			const { data: claims, error } = await supabase.auth.getClaims();
			// consola.log("getAuthenticatedUser claims", claims)
			if (claims?.claims && !error) {
				return { user: normalizeAuthClaims(claims.claims), headers };
			}
			// Fallback to user/session for broader compatibility
		const { data: sessionData } = await supabase.auth.getSession();
		if (sessionData?.session?.user) {
			const u = sessionData.session.user;
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
			};
		}
		return { user: null, headers };
	} catch {
		return { user: null, headers };
	}
}

/**
 * Legacy function that only returns user (for backward compatibility)
 * @deprecated Use getAuthenticatedUser and handle headers properly
 */
export async function getAuthenticatedUserOnly(request: Request) {
	const result = await getAuthenticatedUser(request);
	return result.user;
}

/**
 * Gets the current session from the server-side request
 * Returns null if no valid session
 */
export async function getSession(request: Request) {
	const supabase = getServerClient(request);

	try {
		const {
			data: { session },
			error,
		} = await supabase.client.auth.getSession();
		if (error || !session) {
			return null;
		}
		return session;
	} catch {
		return null;
	}
}

// Anonymous client (no cookies) for server-side actions without user context
export const supabaseAnon = createServerClient<Database, "public">(SUPABASE_URL, SUPABASE_ANON_KEY, {
	db: { schema: "public" },
	cookies: {
		getAll: () => [],
		setAll: () => {},
	},
	auth: { persistSession: false },
});

// Per-request helper that returns a client with a user JWT set for RLS-protected queries
export function getRlsClient(jwt: string) {
	return createServerClient<Database, "public">(SUPABASE_URL, SUPABASE_ANON_KEY, {
		db: { schema: "public" },
		cookies: {
			getAll: () => [],
			setAll: () => {},
		},
		auth: { persistSession: false },
		global: {
			headers: { Authorization: `Bearer ${jwt}` },
		},
	});
}

// Backward compatibility exports
export const supabaseAdmin = createSupabaseAdminClient();
export { supabaseAnon as db };
