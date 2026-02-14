import consola from "consola";
import { PostHog } from "posthog-node";
import { getServerEnv } from "~/env.server";

let client: PostHog | null = null;

export function getPostHogServerClient(): PostHog | null {
	if (client) return client;

	const { POSTHOG_KEY, POSTHOG_HOST } = getServerEnv();
	if (!POSTHOG_KEY) {
		consola.warn("[PostHog] POSTHOG_KEY missing; server analytics disabled");
		return null;
	}

	const host = POSTHOG_HOST ?? "https://us.i.posthog.com";
	client = new PostHog(POSTHOG_KEY, {
		host,
		flushAt: 1,
		flushInterval: 0,
	});

	return client;
}

async function _shutdownPostHog() {
	if (client) {
		await client.shutdown();
		client = null;
	}
}
