import { convertMessages } from "@mastra/core/agent";
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { memory } from "~/mastra/memory";
import type { UpsightMessage } from "~/mastra/message-types";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext);
	const projectId = String(params.projectId || "");
	const _accountId = String(params.accountId || "");
	const userId = ctx?.claims?.sub || "";

	if (!projectId) {
		consola.warn("project-setup history: Missing projectId");
		return Response.json({ error: "Missing projectId" }, { status: 400 });
	}

	if (!userId) {
		consola.warn("project-setup history: Missing userId");
		return Response.json({ error: "Missing userId" }, { status: 401 });
	}

	try {
		const resourceId = `projectSetupAgent-${userId}-${projectId}`;

		// Get the most recent thread for this project
		const threads = await memory.listThreads({
			filter: { resourceId },
			orderBy: { field: "createdAt", direction: "DESC" },
			page: 0,
			perPage: 1,
		});

		if (!threads?.total || threads.total === 0) {
			consola.info("project-setup history: no threads found for resourceId", {
				resourceId,
			});
			return Response.json({ messages: [] });
		}

		const threadId = threads.threads[0].id;
		consola.info("project-setup history: using thread", { threadId });

		// Query messages using Memory API (v1: query() renamed to recall(), messagesV2 renamed to messages)
		const { messages: memoryMessages } = await memory.recall({
			threadId,
			perPage: 20, // Get more messages for setup context
		});

		consola.info("project-setup history loaded", {
			threadId,
			messageCount: memoryMessages?.length || 0,
		});

		// Convert messages to UI format
		let uiMessages: UpsightMessage[] = [];
		if (memoryMessages && memoryMessages.length > 0) {
			uiMessages = convertMessages(memoryMessages).to("AIV5.UI") as UpsightMessage[];
		}

		return Response.json({
			threadId,
			messages: uiMessages,
		});
	} catch (error) {
		consola.error("Error loading project setup chat history:", error);
		return Response.json({ error: "Failed to load chat history" }, { status: 500 });
	}
}
