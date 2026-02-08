import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getSharedPostgresStore } from "~/mastra/memory/shared-postgres-store";

/**
 * API endpoint to clear agent chat history for a user/project
 * POST /api/chat/clear-history
 * Body: { userId, projectId, agentName? }
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	try {
		const body = await request.json();
		const { userId, projectId, agentName = "projectStatusAgent" } = body;

		if (!userId || !projectId) {
			return Response.json({ error: "userId and projectId are required" }, { status: 400 });
		}

		// The resourceId format used by the agent
		const resourceId = `${agentName}-${userId}-${projectId}`;

		consola.info("[clear-history] Clearing history for:", { resourceId });

		const store = getSharedPostgresStore();

		// Get all threads for this resource
		const threads = await store.getThreadsByResourceId({ resourceId });

		if (!threads || threads.length === 0) {
			return Response.json({ success: true, message: "No threads found", threadsDeleted: 0 });
		}

		// Delete each thread
		let deletedCount = 0;
		for (const thread of threads) {
			try {
				await store.deleteThread({ threadId: thread.id });
				deletedCount++;
				consola.info("[clear-history] Deleted thread:", thread.id);
			} catch (err) {
				consola.error("[clear-history] Failed to delete thread:", thread.id, err);
			}
		}

		consola.info("[clear-history] Cleared history:", { resourceId, threadsDeleted: deletedCount });

		return Response.json({
			success: true,
			message: `Cleared ${deletedCount} thread(s)`,
			threadsDeleted: deletedCount,
		});
	} catch (error) {
		consola.error("[clear-history] Error:", error);
		return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
	}
}
