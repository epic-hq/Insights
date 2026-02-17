export const DEFAULT_POSTHOG_HOST = "https://long-pine-hat.jett-1bd.workers.dev";

export function normalizePosthogHost(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
}

export function resolvePosthogHost(value: unknown): string {
	return normalizePosthogHost(value) ?? DEFAULT_POSTHOG_HOST;
}
