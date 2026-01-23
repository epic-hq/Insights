import { convertMessages } from "@mastra/core/agent"
import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { memory } from "~/mastra/memory"
import type { UpsightMessage } from "~/mastra/message-types"
import { userContext } from "~/server/user-context"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const projectId = String(params.projectId || "")
	const _accountId = String(params.accountId || "")
	const userId = ctx?.claims?.sub || ""

	// consola.info("project-status history: params received", {
	// 	projectId,
	// 	accountId,
	// 	userId,
	// 	paramsKeys: Object.keys(params || {}),
	// 	allParams: params,
	// })

	if (!projectId) {
		consola.warn("project-status history: Missing projectId")
		return Response.json({ error: "Missing projectId" }, { status: 400 })
	}

	if (!userId) {
		consola.warn("project-status history: Missing userId")
		return Response.json({ error: "Missing userId" }, { status: 401 })
	}

	try {
		const resourceId = `projectStatusAgent-${userId}-${projectId}`

		// consola.info("project-status history: searching for threads", {
		// 	resourceId,
		// })

		// Get the most recent thread for this project
		const threads = await memory.listThreadsByResourceId({
			resourceId,
			orderBy: { field: "createdAt", direction: "DESC" },
			page: 0,
			perPage: 1,
		})

		// consola.info("project-status history: threads found", {
		// 	total: threads?.total || 0,
		// 	threadsCount: threads?.threads?.length || 0,
		// })

		if (!threads?.total || threads.total === 0) {
			return Response.json({ messages: [] })
		}

		const threadId = threads.threads[0].id

		// Query messages using Memory API (v1: query() renamed to recall(), messagesV2 renamed to messages)
		const { messages } = await memory.recall({
			threadId,
			selectBy: { last: 10 },
		})

		// Convert messages to UI format
		let uiMessages: UpsightMessage[] = []
		if (messages && messages.length > 0) {
			uiMessages = convertMessages(messages).to("AIV5.UI") as UpsightMessage[]
		}

		// consola.info("project-status history: converted to UI format", { uiMessageCount: uiMessages.length, })

		// Return messages in the format expected by the UI
		return Response.json({
			threadId,
			messages: uiMessages,
		})
	} catch (error) {
		consola.error("Error loading project status chat history:", error)
		return Response.json({ error: "Failed to load chat history" }, { status: 500 })
	}
}
