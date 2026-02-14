import { randomUUID } from "node:crypto";
import type { ActionFunctionArgs } from "react-router";

const TRIGGER_ENDPOINT = "https://api.trigger.dev/v3/tasks/run";

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		throw new Response("Method not allowed", { status: 405 });
	}

	const triggerApiKey = process.env.TRIGGER_API_KEY;
	if (!triggerApiKey) {
		throw new Error("Missing TRIGGER_API_KEY");
	}

	const { key, mediaId, accountId, projectId, userId, profile } = (await request.json()) as {
		key?: string;
		mediaId?: string;
		accountId?: string;
		projectId?: string;
		userId?: string;
		profile?: string;
	};

	if (!key || !mediaId || !accountId || !projectId || !userId) {
		return { error: "key, mediaId, accountId, projectId, and userId are required" };
	}

	const payload = {
		idempotencyKey: randomUUID(),
		task: "transcode-audio",
		payload: {
			key,
			mediaId,
			accountId,
			projectId,
			userId,
			profile: profile ?? process.env.TRANSCODE_PROFILE ?? "speech_mp3_low",
		},
	};

	const response = await fetch(TRIGGER_ENDPOINT, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${triggerApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	const rawBody = await response.text();
	let parsedBody: unknown;
	try {
		parsedBody = rawBody ? JSON.parse(rawBody) : null;
	} catch (error) {
		parsedBody = { message: rawBody, parseError: (error as Error).message };
	}

	if (!response.ok) {
		return {
			error: "Failed to trigger transcription job",
			status: response.status,
			body: parsedBody,
		};
	}

	return {
		success: true as const,
		status: response.status,
		body: parsedBody,
	};
}
