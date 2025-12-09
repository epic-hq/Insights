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
	const interviewId = String(params.interviewId || params.interview_id || "")
	const userId = ctx?.claims?.sub || ""

	if (!projectId || !interviewId) {
		return new Response(JSON.stringify({ error: "Missing projectId or interviewId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const { messages, system } = await request.json()

	const resourceId = `interviewStatusAgent-${userId}-${interviewId}`
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
			title: `Interview ${interviewId}`,
			metadata: { user_id: userId, project_id: projectId, account_id: accountId, interview_id: interviewId },
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const runtimeContext = new RuntimeContext()
	runtimeContext.set("user_id", userId)
	runtimeContext.set("account_id", accountId)
	runtimeContext.set("project_id", projectId)
	runtimeContext.set("interview_id", interviewId)

	const agent = mastra.getAgent("interviewStatusAgent")
	const result = await agent.stream(messages, {
		format: "aisdk",
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
			consola.log("interview-status onFinish", data)
			const langfuse = getLangfuseClient()
			const lfTrace = langfuse.trace?.({ name: "api.chat.interview" })
			const gen = lfTrace?.generation?.({
				name: "api.chat.interview",
				input: messages,
				output: data,
			})
			gen?.end?.()
		},
	})

	return result.toUIMessageStreamResponse()
}
