import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	// With Fluid compute, don't put this client in a global environment
	// variable. Always create a new one on each request.
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
					supabaseResponse = NextResponse.next({
						request,
					});
					cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
				},
			},
		}
	);

	// Do not run code between createServerClient and
	// supabase.auth.getClaims(). A simple mistake could make it very hard to debug
	// issues with users being randomly logged out.

	// IMPORTANT: If you remove getClaims() and you use server-side rendering
	// with the Supabase client, your users may be randomly logged out.
	const { data } = await supabase.auth.getClaims();
	const user = data?.claims;

	// Track daily session start in PostHog (first request of the day)
	if (user?.sub) {
		const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
		const lastSessionDate = request.cookies.get("last_session_date")?.value;

		// If this is the first request today, track session_started
		if (lastSessionDate !== today) {
			try {
				const { getPostHogServerClient } = await import("../posthog.server");
				const posthog = getPostHogServerClient();
				if (posthog) {
					// Fire and forget - don't block request
					posthog
						.capture({
							distinctId: user.sub,
							event: "session_started",
							properties: {
								session_date: today,
								timestamp: new Date().toISOString(),
								user_agent: request.headers.get("user-agent") ?? undefined,
								referrer: request.headers.get("referer") ?? undefined,
							},
						})
						.catch((error) => {
							console.error("[PostHog] Failed to track session_started", error);
						});
				}
			} catch (error) {
				// Non-fatal: PostHog tracking failure shouldn't break auth
				console.warn("[PostHog] Failed to load PostHog client", error);
			}

			// Update the session date cookie
			supabaseResponse.cookies.set("last_session_date", today, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 60 * 60 * 24 * 365, // 1 year
				path: "/",
			});
		}
	}

	if (!user && !request.nextUrl.pathname.startsWith("/login") && !request.nextUrl.pathname.startsWith("/auth")) {
		// no user, potentially respond by redirecting the user to the login page
		const url = request.nextUrl.clone();
		url.pathname = "/auth/login";
		return NextResponse.redirect(url);
	}

	// IMPORTANT: You *must* return the supabaseResponse object as it is.
	// If you're creating a new response object with NextResponse.next() make sure to:
	// 1. Pass the request in it, like so:
	//    const myNewResponse = NextResponse.next({ request })
	// 2. Copy over the cookies, like so:
	//    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
	// 3. Change the myNewResponse object to fit your needs, but avoid changing
	//    the cookies!
	// 4. Finally:
	//    return myNewResponse
	// If this is not done, you may be causing the browser and server to go out
	// of sync and terminate the user's session prematurely!

	return supabaseResponse;
}
