/**
 * API endpoint to load chat history for a specific thread.
 * Query param: ?threadId=xxx
 */

import { convertMessages } from "@mastra/core/agent";
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { findProjectStatusThread } from "~/features/project-chat/project-status-threads.server";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";

export async function loader({ request, context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	if (!userId) {
		return Response.json({ error: "Missing userId" }, { status: 401 });
	}

	const url = new URL(request.url);
	const threadId = url.searchParams.get("threadId");

	if (!threadId) {
		return Response.json({ error: "Missing threadId" }, { status: 400 });
	}

	try {
		const thread = await findProjectStatusThread({
			memory,
			userId,
			projectId,
			threadId,
		});
		if (!thread) {
			return Response.json({ error: "Thread not found" }, { status: 404 });
		}

		const { messages } = await memory.recall({
			threadId,
			perPage: 100,
		});

		let uiMessages: UpsightMessage[] = [];
		if (messages && messages.length > 0) {
			uiMessages = convertMessages(messages).to("AIV5.UI") as UpsightMessage[];
		}

		return Response.json({
			threadId,
			messages: uiMessages,
		});
	} catch (error) {
		consola.error("Error loading thread history:", error);
		return Response.json({ error: "Failed to load thread history" }, { status: 500 });
	}
}
