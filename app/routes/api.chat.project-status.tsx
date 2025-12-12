import { toAISdkFormat } from "@mastra/ai-sdk"
import { RuntimeContext } from "@mastra/core/di"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
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
	// We look for the last user message and include it (the new turn).
	const lastUserIndex = sanitizedMessages.findLastIndex((m: { role?: string }) => m?.role === "user")

	// If we have a user message, start from there. Otherwise use all messages.
	// This ensures we always send at least the new user message to the agent.
	const runtimeMessages = lastUserIndex >= 0 ? sanitizedMessages.slice(lastUserIndex) : sanitizedMessages

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

	// Helper to run agent stream with memory
	const runAgentStream = async (useThreadId: string) => {
		return agent.stream(runtimeMessages, {
			maxSteps: 10, // Prevent infinite tool loops (default is 5)
			memory: {
				thread: useThreadId,
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
				// Log summary only, not full data dump
				consola.info("project-status onFinish", {
					finishReason: data.finishReason,
					toolCallsCount: data.toolCalls?.length || 0,
					textLength: data.text?.length || 0,
					stepsCount: data.steps?.length || 0,
				})
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
	}

	let stream
	try {
		stream = await runAgentStream(threadId)
	} catch (error) {
		// Check if this is the "No tool call found" error from corrupted memory
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
			consola.warn("project-status action: Corrupted thread detected, creating fresh thread", { threadId, error: errorMessage })

			// Create a new thread and retry
			const freshThread = await memory.createThread({
				resourceId,
				title: `Project Status ${projectId} (fresh)`,
				metadata: { user_id: userId, project_id: projectId, account_id: accountId },
			})
			threadId = freshThread.id
			consola.info("project-status action: Created fresh thread", { newThreadId: threadId })

			stream = await runAgentStream(threadId)
		} else {
			throw error
		}
	}

	// Transform Mastra stream to AI SDK format with custom data parts support
	const uiMessageStream = createUIMessageStream({
		execute: async ({ writer }) => {
			try {
				const transformedStream = toAISdkFormat(stream, { from: "agent" })
				if (transformedStream) {
					for await (const part of transformedStream) {
						writer.write(part)
					}
				}
			} catch (streamError) {
				// Check if this is the "No tool call found" error from corrupted memory
				const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
				if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
					consola.warn("project-status stream: Corrupted thread detected during streaming, creating fresh thread", { threadId, error: errorMessage })

					// Create a new thread and retry
					const freshThread = await memory.createThread({
						resourceId,
						title: `Project Status ${projectId} (fresh)`,
						metadata: { user_id: userId, project_id: projectId, account_id: accountId },
					})
					consola.info("project-status stream: Created fresh thread, retrying", { newThreadId: freshThread.id })

					// Retry with fresh thread
					const freshStream = await runAgentStream(freshThread.id)
					const freshTransformed = toAISdkFormat(freshStream, { from: "agent" })
					if (freshTransformed) {
						for await (const part of freshTransformed) {
							writer.write(part)
						}
					}
				} else {
					// Re-throw other errors
					throw streamError
				}
			}
		},
	})

	return createUIMessageStreamResponse({ stream: uiMessageStream })
}
