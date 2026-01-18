import { handleNetworkStream } from "@mastra/ai-sdk"
import { RequestContext } from "@mastra/core/di"
import { createUIMessageStreamResponse } from "ai"
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

	// Set up billing context for agent LLM calls
	const billingCtx = userBillingContext({
		accountId,
		userId,
		featureSource: "project_status_agent",
		projectId,
	})
	setActiveBillingContext(billingCtx, `agent:project-status:${userId}:${projectId}`)

	const buildAgentParams = (useThreadId: string) => ({
		messages: runtimeMessages,
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
		onFinish: async (data: {
			usage?: { inputTokens?: number; outputTokens?: number }
			finishReason?: string
			toolCalls?: unknown[]
			text?: string
			steps?: unknown[]
		}) => {
			const usage = data.usage
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

			clearActiveBillingContext()

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

	let stream: Awaited<ReturnType<typeof handleNetworkStream>> | undefined
	try {
		stream = await handleNetworkStream({
			mastra,
			agentId: "projectStatusAgent",
			params: buildAgentParams(threadId),
		})
	} catch (error) {
		// Check if this is the "No tool call found" error from corrupted memory
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (errorMessage.includes("No tool call found") || errorMessage.includes("function call output")) {
			threadId = await handleCorruptedThread(threadId, errorMessage)
			stream = await handleNetworkStream({
				mastra,
				agentId: "projectStatusAgent",
				params: buildAgentParams(threadId),
			})
		} else {
			throw error
		}
	}
	return createUIMessageStreamResponse({ stream })
}
