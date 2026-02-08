import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { extractUtmParamsFromSearch, hasUtmParams, mergeUtmParams, UTM_COOKIE_NAME, type UtmParams } from "./utm";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export function extractUtmParamsFromRequest(request: Request): UtmParams {
	const url = new URL(request.url);
	return extractUtmParamsFromSearch(url);
}

function readUtmCookie(request: Request): UtmParams {
	const allCookies = parseCookieHeader(request.headers.get("Cookie") ?? "");
	const utmCookie = allCookies.find((cookie) => cookie.name === UTM_COOKIE_NAME);

	if (!utmCookie?.value) {
		return {};
	}

	try {
		return JSON.parse(decodeURIComponent(utmCookie.value)) as UtmParams;
	} catch {
		return {};
	}
}

function _serializeUtmCookie(params: UtmParams): string | null {
	if (!hasUtmParams(params)) {
		return null;
	}

	const value = encodeURIComponent(JSON.stringify(params));
	return serializeCookieHeader(UTM_COOKIE_NAME, value, {
		path: "/",
		maxAge: ONE_WEEK_SECONDS,
		httpOnly: false,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
	});
}

export function clearUtmCookie(): string {
	return serializeCookieHeader(UTM_COOKIE_NAME, "", {
		path: "/",
		maxAge: 0,
		httpOnly: false,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
	});
}

export function collectPersistedUtmParams(request: Request, extra?: UtmParams): UtmParams {
	const fromCookie = readUtmCookie(request);
	return mergeUtmParams(fromCookie, extra);
}
