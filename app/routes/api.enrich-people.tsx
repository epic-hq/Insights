/**
 * API route to trigger batch people data enrichment
 *
 * POST: Trigger batch enrichment task via Trigger.dev
 * Returns taskId for tracking progress
 */

import { auth, tasks } from "@trigger.dev/sdk/v3";
import type { ActionFunctionArgs } from "react-router";
import type { enrichPeopleBatchTask } from "~/../src/trigger/people/enrichPeopleBatch";
import { getServerClient } from "~/lib/supabase/client.server";

async function createAccessToken(runId: string): Promise<string | null> {
	try {
		return await auth.createPublicToken({
			scopes: {
				read: {
					runs: [runId],
					tasks: ["people.enrich-batch"],
				},
			},
			expirationTime: "1h",
		});
	} catch (error) {
		console.warn("[enrich-people] Failed to create public token:", error);
		return null;
	}
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 });
	}

	try {
		const { getAuthenticatedUser } = await import("~/lib/supabase/client.server");
		const { user: claims } = await getAuthenticatedUser(request);
		if (!claims?.sub) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { client: userDb } = getServerClient(request);

		const body = await request.json();
		const projectId = body.projectId;
		const personIds = body.personIds as string[] | undefined;
		const rescore = body.rescore !== false; // Default true

		if (!projectId) {
			return Response.json({ success: false, error: "Missing projectId" }, { status: 400 });
		}

		// Verify project exists and user has access
		const { data: project, error: projectError } = await userDb
			.from("projects")
			.select("id, account_id")
			.eq("id", projectId)
			.single();

		if (projectError || !project) {
			return Response.json({ success: false, error: "Project not found" }, { status: 404 });
		}

		// Trigger the enrichment task
		const handle = await tasks.trigger<typeof enrichPeopleBatchTask>("people.enrich-batch", {
			projectId: project.id,
			accountId: project.account_id,
			personIds,
			rescore,
		});

		// Create public access token for realtime progress
		const publicAccessToken = await createAccessToken(handle.id);

		return Response.json({
			success: true,
			taskId: handle.id,
			publicAccessToken,
			message: personIds?.length ? `Enriching ${personIds.length} people` : "Enriching people with missing data",
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : "Unknown error";
		console.error("[enrich-people] Error:", error);
		return Response.json({ success: false, error: msg || "Failed to trigger enrichment" }, { status: 500 });
	}
}
