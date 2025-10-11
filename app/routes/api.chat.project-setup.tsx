import { RuntimeContext } from "@mastra/core/di"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { mastra } from "~/mastra"
import { memory } from "~/mastra/memory"
import { userContext } from "~/server/user-context"

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}
	const ctx = context.get(userContext)
	const accountId = String(params.accountId || ctx?.account_id || "")
	const projectId = String(params.projectId || "")
	const userId = ctx.claims.sub

	if (!projectId) {
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const { messages, system } = await request.json()

	// Reuse latest thread for this project-scoped agent
	const resourceId = `projectSetupAgent-${userId}-${projectId}`
	const threads = await memory.getThreadsByResourceIdPaginated({
		resourceId,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	let threadId = ""
	if (!(threads?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Setup ${projectId}`,
			metadata: { user_id: userId, project_id: projectId, account_id: accountId },
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const runtimeContext = new RuntimeContext()
	runtimeContext.set("user_id", userId)
	runtimeContext.set("account_id", accountId)
	runtimeContext.set("project_id", projectId)

	const agent = mastra.getAgent("projectSetupAgent")
	const result = await agent.stream(messages, {
		memory: {
			thread: threadId,
			resource: resourceId,
		},
		runtimeContext,
		context: system
			? [
					{
						role: "system",
						content: `## Context from the client's UI:\n${system}`,
					},
				]
			: undefined,
		onFinish: (data) => {
			consola.log("project-setup onFinish", data)
			// Log to Langfuse
			const langfuse = getLangfuseClient()
			const lfTrace = langfuse.trace?.({ name: "api.chat.project-setup" })
			const gen = lfTrace?.generation?.({
				name: "api.chat.project-setup",
				input: messages,
				output: data,
			})
			gen?.end?.()
		},
	})

	// Return AI SDK v5 compatible stream response
	// @ts-expect-error - toDataStreamResponse is added at runtime by attachStreamResultAliases
	return result.toDataStreamResponse()
}
