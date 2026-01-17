import { toAISdkStream } from "@mastra/ai-sdk"
import { RequestContext } from "@mastra/core/di"
import { createUIMessageStream, createUIMessageStreamResponse } from "ai"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import {
	clearActiveBillingContext,
	estimateOpenAICost,
	setActiveBillingContext,
	userBillingContext,
} from "~/lib/billing/instrumented-openai.server"
import { recordUsageOnly } from "~/lib/billing/usage.server"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { mastra } from "~/mastra"
import { memory } from "~/mastra/memory"
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils"
import { userContext } from "~/server/user-context"

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}

	const ctx = context.get(userContext)
	const projectId = String(params.projectId || "")
	// IMPORTANT: Resolve account_id from project, not URL params or session
	// This prevents data being created with wrong account when user has multiple accounts
	const fallbackAccountId = String(params.accountId || ctx?.account_id || "")
	const accountId = await resolveAccountIdFromProject(projectId, "api.chat.project-status", fallbackAccountId)
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
	consola.info("project-status action: received userTimezone", {
		userTimezone,
	})
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

	const threadsStart = Date.now()
	const threads = await memory.listThreadsByResourceId({
		resourceId,
		orderBy: { field: "createdAt", direction: "DESC" },
		page: 0,
		perPage: 1,
	})
	consola.info("project-status action: threads fetched", {
		durationMs: Date.now() - threadsStart,
		total: threads?.total,
	})

	let threadId = ""
	if (!(threads?.total && threads.total > 0)) {
		const newThread = await memory.createThread({
			resourceId,
			title: `Project Status ${projectId}`,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
			},
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const requestContext = new RequestContext()
	requestContext.set("user_id", userId)
	requestContext.set("account_id", accountId)
	requestContext.set("project_id", projectId)
	if (userTimezone) {
		requestContext.set("user_timezone", userTimezone)
	}

	consola.info("project-status action: requestContext values", {
		userId: requestContext.get("user_id"),
		accountId: requestContext.get("account_id"),
		projectId: requestContext.get("project_id"),
	})

	const agent = mastra.getAgent("projectStatusAgent")

	// Set up billing context for agent LLM calls
	const billingCtx = userBillingContext({
		accountId,
		userId,
		featureSource: "project_status_agent",
		projectId,
	})
	setActiveBillingContext(billingCtx, `agent:project-status:${userId}:${projectId}`)

	// Helper to run agent network with memory
	const runAgentStream = async (useThreadId: string) => {
		return agent.network(runtimeMessages, {
			maxSteps: 10, // Prevent infinite tool loops (default is 5)
			memory: {
				thread: useThreadId,
				resource: resourceId,
			},
			requestContext,
			context: system
				? [
					{
						role: "system",
						content: `## Context from the client's UI:\n${system}`,
					},
				]
				: undefined,
			onFinish: async (data) => {
				// Record usage BEFORE clearing billing context
				// The data object contains usage from all steps aggregated
				// Mastra uses inputTokens/outputTokens (not promptTokens/completionTokens)
				const usage = (
					data as {
						usage?: { inputTokens?: number; outputTokens?: number }
					}
				).usage
				if (usage && (usage.inputTokens || usage.outputTokens) && billingCtx.accountId) {
					const model = "gpt-4o" // Default model for agents
					const inputTokens = usage.inputTokens || 0
					const outputTokens = usage.outputTokens || 0
					const costUsd = estimateOpenAICost(model, inputTokens, outputTokens)

					consola.info("project-status billing recorded", {
						inputTokens,
						outputTokens,
						costUsd,
					})

					await recordUsageOnly(
						billingCtx,
						{
							provider: "openai",
							model,
							inputTokens,
							outputTokens,
							estimatedCostUsd: costUsd,
						},
						`agent:project-status:${userId}:${projectId}:${Date.now()}`
					).catch((err) => {
						consola.error("[billing] Failed to record agent usage:", err)
					})
				}

				// Clear billing context when agent finishes
				clearActiveBillingContext()

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

	// Helper to handle corrupted thread recovery
	const handleCorruptedThread = async (corruptedThreadId: string, errorMessage: string) => {
		consola.warn("project-status: Corrupted thread detected, deleting and creating fresh", {
			corruptedThreadId,
			error: errorMessage,
		})

		// Delete the corrupted thread so it doesn't get picked up again
		try {
			await memory.deleteThread(corruptedThreadId)
			consola.info("project-status: Deleted corrupted thread", {
				corruptedThreadId,
			})
		} catch (deleteError) {
			consola.error("project-status: Failed to delete corrupted thread", {
				corruptedThreadId,
				deleteError,
			})
		}

		// Create a fresh thread
		const freshThread = await memory.createThread({
			resourceId,
			title: `Project Status ${projectId}`,
			metadata: {
				user_id: userId,
				project_id: projectId,
				account_id: accountId,
			},
		})
		consola.info("project-status: Created fresh thread", {
			newThreadId: freshThread.id,
		})
		return freshThread.id
	}

	let stream: Awaited<ReturnType<typeof runAgentStream>> | undefined
	try {
		stream = await runAgentStream(threadId)
	} catch (error) {
		// Check if this is the "No tool call found" error from corrupted memory
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
			threadId = await handleCorruptedThread(threadId, errorMessage)
			stream = await runAgentStream(threadId)
		} else {
			throw error
		}
	}

	// Transform Mastra stream to AI SDK format with custom data parts support
	// Enable sendReasoning to stream LLM thinking/reasoning tokens to frontend
	const toAISdkOptions = {
		from: "agent" as const,
		sendReasoning: true,
		sendSources: true,
	}

	const uiMessageStream = createUIMessageStream({
		execute: async ({ writer }) => {
			try {
				// Create async generator to intercept network events and emit status updates
				async function* interceptStream() {
					for await (const chunk of stream) {
						// Emit status updates for network routing events
						if (chunk.type === "routing-agent-start") {
							writer.writeData({
								type: "status",
								status: "thinking",
								message: "Thinking...",
							})
						} else if (chunk.type === "routing-agent-end") {
							writer.writeData({
								type: "status",
								status: "routing",
								message: "Routing...",
							})
						} else if (chunk.type === "agent-execution-start") {
							const agentName = (chunk as any).payload?.agentName || "specialist"
							const displayName = agentName === "taskAgent" ? "Task Agent" : agentName
							writer.writeData({
								type: "status",
								status: "executing",
								message: displayName,
							})
						} else if (chunk.type === "agent-execution-end") {
							writer.writeData({
								type: "status",
								status: "complete",
								message: "Done",
							})
						}
						// Yield chunk for transformation
						yield chunk
					}
				}

				const transformedStream = toAISdkStream(interceptStream(), toAISdkOptions)
				if (transformedStream) {
					for await (const part of transformedStream) {
						writer.write(part)
					}
				}
			} catch (streamError) {
				// Check if this is the "No tool call found" error from corrupted memory
				const errorMessage = streamError instanceof Error ? streamError.message : String(streamError)
				if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
					// Delete corrupted thread and retry with fresh one
					const freshThreadId = await handleCorruptedThread(threadId, errorMessage)
					const freshStream = await runAgentStream(freshThreadId)
					const freshTransformed = toAISdkStream(freshStream, toAISdkOptions)
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
