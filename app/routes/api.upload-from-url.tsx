import type { UUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import type { importFromUrlTask } from "~/../src/trigger/interview/importFromUrl";
import { getServerClient } from "~/lib/supabase/client.server";
import { userContext } from "~/server/user-context";

/**
 * Upload from URL API
 *
 * Uses the same Trigger.dev importFromUrlTask as the chat agent for:
 * - Consistent behavior across all entry points
 * - HLS/DASH stream support via ffmpeg
 * - Proper media extraction from webpages (Vento.so, Apollo.io, etc.)
 * - Reliable transcription and processing pipeline
 */
export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	const ctx = context.get(userContext);
	const supabase = ctx?.supabase ?? getServerClient(request).client;
	const userId = ctx?.claims?.sub ?? null;

	try {
		const formData = await request.formData();
		const projectId = formData.get("projectId") as UUID;
		const url = formData.get("url") as string;
		const title = formData.get("title") as string | null;
		const personId = formData.get("personId") as string | null;

		consola.info("[upload-from-url] Received request", { url, projectId, personId });

		if (!url || !projectId) {
			return Response.json({ error: "URL and projectId are required" }, { status: 400 });
		}

		// Get account ID from project
		const { data: projectRow, error: projectError } = await supabase
			.from("projects")
			.select("account_id")
			.eq("id", projectId)
			.single();

		if (projectError || !projectRow?.account_id) {
			consola.error("[upload-from-url] Unable to resolve project account", projectId, projectError);
			return Response.json({ error: "Unable to resolve project account" }, { status: 404 });
		}

		const accountId = projectRow.account_id;

		// Use the same Trigger.dev task as the chat agent
		// This handles:
		// - Media URL extraction from webpages (Vento.so, Apollo.io, etc.)
		// - HLS/DASH stream downloading via ffmpeg
		// - Progressive media file downloading
		// - R2 upload
		// - Interview creation
		// - Transcription and processing
		consola.info("[upload-from-url] Triggering importFromUrlTask", { url, projectId, accountId });

		const handle = await tasks.trigger<typeof importFromUrlTask>("interview.import-from-url", {
			urls: [
				{
					url,
					title: title || undefined,
					personId: personId || undefined,
				},
			],
			projectId,
			accountId,
			userId: userId || null,
		});

		consola.info("[upload-from-url] Task triggered successfully", {
			runId: handle.id,
			publicToken: handle.publicAccessToken,
		});

		return Response.json({
			success: true,
			message:
				"Import queued. The video/audio will be downloaded, transcribed, and processed. This may take a few minutes.",
			triggerRunId: handle.id,
			publicRunToken: handle.publicAccessToken ?? null,
		});
	} catch (error) {
		consola.error("[upload-from-url] Error triggering import task", error);
		return Response.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
	}
}
