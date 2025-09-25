import { RuntimeContext } from "@mastra/core/di"
import { Memory } from "@mastra/memory"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse"
import { getAuthenticatedUser } from "~/lib/supabase/server"
import { mastra } from "~/mastra"
import { memory } from "~/mastra/memory"
import { userContext } from "~/server/user-context"

export async function action({ request, context, params }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}
	const ctx = context.get(userContext)
	const accountId = String(params.accountId || ctx?.account_id || "")
	const projectId = String(params.projectId || "")

	if (!projectId) {
		return new Response(JSON.stringify({ error: "Missing projectId" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	const { messages, tools, system } = await request.json()

	// Reuse latest thread for this project-scoped agent
	const resourceId = `projectSetupAgent-${user.sub}-${projectId}`
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
			metadata: { user_id: user.sub, project_id: projectId, account_id: accountId },
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const runtimeContext = new RuntimeContext()
	runtimeContext.set("user_id", user.sub)
	runtimeContext.set("account_id", accountId)
	runtimeContext.set("project_id", projectId)

	const agent = mastra.getAgent("projectSetupAgent")
	const result = await agent.streamVNext(messages, {
		format: "aisdk",
		resourceId,
		threadId,
		runtimeContext,
		// @ts-expect-error tools passthrough
		clientTools: tools ? frontendTools(tools) : undefined,
		context: system
			? [
				{
					role: "system",
					content: `## Context from the client's UI:\n${system}`,
				},
			]
			: undefined,
		onFinish: (data) => consola.log("project-setup onFinish", data),
	})

	const langfuse = getLangfuseClient()
	void result
		.getFullOutput()
		.then((full) => {
			consola.log("Project-setup full output:", full)
			const lfTrace = langfuse.trace?.({ name: "api.chat.project-setup" })
			const gen = lfTrace?.generation?.({ name: "api.chat.project-setup", input: messages, output: full?.content })
			gen?.end?.()
		})
		.catch((err) => consola.error("getFullOutput failed:", err))

	return result.toUIMessageStreamResponse()
}
