// The client you created from the Server-Side Auth instructions

import consola from "consola";
import { type LoaderFunctionArgs, redirect } from "react-router";
import { getServerClient } from "~/lib/supabase/client.server";

export async function loader({ request }: LoaderFunctionArgs) {
	consola.log("[OAUTH ROUTE] ===== OAUTH ROUTE RECEIVED =====");
	const { searchParams, origin } = new URL(request.url);
	consola.log(`[OAUTH ROUTE] Full URL: ${request.url}`);
	consola.log(`[OAUTH ROUTE] Origin: ${origin}`);
	consola.log(`[OAUTH ROUTE] Host: ${new URL(request.url).host}`);
	consola.log(`[OAUTH ROUTE] Pathname: ${new URL(request.url).pathname}`);
	consola.log("[OAUTH ROUTE] Search params:", Object.fromEntries(searchParams));
	const code = searchParams.get("code");
	// if "next" is in param, use it as the redirect URL
	let next = searchParams.get("next") ?? "/";
	const invite_token = searchParams.get("invite_token");

	consola.log(`[OAUTH ROUTE] Code present: ${!!code}`);
	consola.log(`[OAUTH ROUTE] Next param: ${next}`);
	consola.log(`[OAUTH ROUTE] Invite token: ${!!invite_token}`);
	consola.log(`[OAUTH ROUTE] User-Agent: ${request.headers.get("user-agent")}`);
	consola.log(`[OAUTH ROUTE] Referer: ${request.headers.get("referer")}`);
	consola.log("[OAUTH ROUTE] ===================================");

	if (!next.startsWith("/")) {
		// if "next" is not a relative URL, use the default
		next = "/";
	}
	consola.log(`redirecting to ${next}`);

	if (code) {
		const { client, headers } = getServerClient(request);
		consola.log("[OAUTH ROUTE] Attempting code exchange...");
		const { error } = await client.auth.exchangeCodeForSession(code);
		consola.log("[OAUTH ROUTE] Exchange result:", { success: !error, error: error?.message });

		if (!error) {
			consola.log("[OAUTH ROUTE] Exchange successful, proceeding with redirect");
			// Prefer original host if behind a proxy, otherwise use relative redirect in dev
			const forwardedHost = request.headers.get("x-forwarded-host");
			const isLocalEnv = process.env.NODE_ENV === "development";
			const suffix = invite_token ? `?invite_token=${invite_token}` : "";
			if (isLocalEnv) {
				// Relative redirect avoids any subtle cross-origin handling in dev and preserves Set-Cookie
				consola.log(`redirecting to (relative) ${next}${suffix}`);
				return redirect(`${next}${suffix}`, { headers });
			}
			if (forwardedHost) {
				const redirectUrl = `https://${forwardedHost}${next}${suffix}`;
				consola.log(`[OAUTH ROUTE] Redirecting to forwarded host: ${redirectUrl}`);
				return redirect(redirectUrl, { headers });
			}
			const redirectUrl = `${origin}${next}${suffix}`;
			consola.log(`[OAUTH ROUTE] Redirecting to origin: ${redirectUrl}`);
			return redirect(redirectUrl, { headers });
		}
		consola.error("[OAUTH ROUTE] Code exchange failed:", error);
		// If PKCE fails, redirect back to login with error
		const loginUrl = `/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`;
		consola.log(`[OAUTH ROUTE] Redirecting to login with error: ${loginUrl}`);
		return redirect(loginUrl);
	}
}
