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
	const userId = ctx?.claims?.sub || ""

	consola.info("project-status action: received request", {
		accountId,
		projectId,
		userId,
		paramsAccountId: params.accountId,
		paramsProjectId: params.projectId,
		ctxAccountId: ctx?.account_id,
	})

	if (!projectId) {
		consola.warn("project-status action: Missing projectId")
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const { messages, system } = await request.json()
	const sanitizedMessages = Array.isArray(messages)
		? messages.map((message) => {
				if (!message || typeof message !== "object") return message
				const cloned = { ...message }
				if ("id" in cloned) {
					delete (cloned as Record<string, unknown>).id
				}
				return cloned
		  })
		: []

	const latestUserMessage = [...sanitizedMessages]
		.reverse()
		.find((message) => Boolean(message && typeof message === "object" && message.role === "user"))

	if (!latestUserMessage || typeof latestUserMessage !== "object") {
		consola.warn("project-status action: missing latest user message in payload")
		return new Response(JSON.stringify({ error: "Missing user prompt" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const runtimeMessages = [latestUserMessage]

	const resourceId = `projectStatusAgent-${userId}-${projectId}`

	consola.info("project-status action: using resourceId", { resourceId })
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
			title: `Project Status ${projectId}`,
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

	const agent = mastra.getAgent("projectStatusAgent")
	const result = await agent.stream(runtimeMessages, {
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
			consola.log("project-status onFinish", data)
			const langfuse = getLangfuseClient()
			const lfTrace = langfuse.trace?.({ name: "api.chat.project-status" })
			const gen = lfTrace?.generation?.({
				name: "api.chat.project-status",
				input: messages,
				output: data,
			})
			gen?.end?.()
		},
	})

	// @ts-expect-error added at runtime via attachStreamResultAliases
	return result.toDataStreamResponse()
}
