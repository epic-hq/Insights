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

	const { messages, system, userTimezone } = await request.json()
	consola.info("project-status action: received userTimezone", { userTimezone })
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

	// Validate that we have at least one user message
	const hasUserMessage = sanitizedMessages.some(
		(message: { role?: string }) => message && typeof message === "object" && message.role === "user"
	)

	if (!hasUserMessage) {
		consola.warn("project-status action: missing user message in payload")
		return new Response(JSON.stringify({ error: "Missing user prompt" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	// Only pass NEW messages to the agent - Mastra's memory handles historical context.
	// This prevents duplicate messages when both client history and memory are present.
	// We look for messages that came after any assistant response (new conversation turn).
	const lastAssistantIndex = sanitizedMessages.findLastIndex(
		(m: { role?: string }) => m?.role === "assistant"
	)
	const runtimeMessages = lastAssistantIndex >= 0
		? sanitizedMessages.slice(lastAssistantIndex + 1)
		: sanitizedMessages

	consola.info("project-status action: sending messages to agent", {
		totalReceived: sanitizedMessages.length,
		messageCount: runtimeMessages.length,
		roles: runtimeMessages.map((m: { role?: string }) => m?.role),
	})

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
	if (userTimezone) {
		runtimeContext.set("user_timezone", userTimezone)
	}

	const agent = mastra.getAgent("projectStatusAgent")
	const result = await agent.stream(runtimeMessages, {
		format: "aisdk", // Required for toUIMessageStreamResponse() - deprecation warning is expected until we migrate to @mastra/ai-sdk chatRoute
		maxSteps: 10, // Prevent infinite tool loops (default is 5)
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

	return result.toUIMessageStreamResponse()
}
