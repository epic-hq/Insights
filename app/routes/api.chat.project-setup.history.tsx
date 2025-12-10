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

	if (!projectId) {
		consola.warn("project-setup history: Missing projectId")
		return Response.json({ error: "Missing projectId" }, { status: 400 })
	}

	if (!userId) {
		consola.warn("project-setup history: Missing userId")
		return Response.json({ error: "Missing userId" }, { status: 401 })
	}

	try {
		const resourceId = `projectSetupAgent-${userId}-${projectId}`

		// Get the most recent thread for this project
		const threads = await memory.getThreadsByResourceIdPaginated({
			resourceId,
			orderBy: "createdAt",
			sortDirection: "DESC",
			page: 0,
			perPage: 1,
		})

		if (!threads?.total || threads.total === 0) {
			consola.info("project-setup history: no threads found for resourceId", { resourceId })
			return Response.json({ messages: [] })
		}

		const threadId = threads.threads[0].id
		consola.info("project-setup history: using thread", { threadId })

		// Query messages using Memory API
		const { messagesV2 } = await memory.query({
			threadId,
			selectBy: { last: 20 }, // Get more messages for setup context
		})

		consola.info("project-setup history loaded", {
			threadId,
			messageCount: messagesV2?.length || 0,
		})

		// Convert messages to UI format
		let uiMessages: UpsightMessage[] = []
		if (messagesV2 && messagesV2.length > 0) {
			uiMessages = convertMessages(messagesV2).to("AIV5.UI") as UpsightMessage[]
		}

		return Response.json({
			threadId,
			messages: uiMessages,
		})
	} catch (error) {
		consola.error("Error loading project setup chat history:", error)
		return Response.json({ error: "Failed to load chat history" }, { status: 500 })
	}
}
