import { frontendTools } from "@assistant-ui/react-ai-sdk"
import { RuntimeContext } from "@mastra/core/di"
import { Memory } from "@mastra/memory"
import { ModelMessage } from "ai"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getLangfuseClient } from "~/lib/langfuse"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { mastra } from "~/mastra"
import { getSharedPostgresStore } from "~/mastra/storage/postgres-singleton"

const memory = new Memory({
	storage: getSharedPostgresStore(),
})

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 })
	}

	// Auth + DB client for actions
	const user = await getAuthenticatedUser(request)
	if (!user) {
		throw new Response("Unauthorized", { status: 401 })
	}
	const { client: supabase } = getServerClient(request)

	const { messages, tools, system } = await request.json()
	// Basic usage with default parameters
	const threads = await memory.getThreadsByResourceIdPaginated({
		resourceId: `signupAgent-${user.sub}`,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	consola.log("Result: ", threads)
	let threadId = ""

	if (!(threads?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId: `signupAgent-${user.sub}`,
			title: "Signup Chat",
			metadata: {
				user_id: user.sub,
			},
		})
		consola.log("New thread created: ", newThread)
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const runtimeContext = new RuntimeContext()
	runtimeContext.set("user_id", user.sub)

	// Get the chefAgent instance from Mastra
	const agent = mastra.getAgent("signupAgent")
	// Stream the response using the agent
	//  NOTE: ON AI SDK V5
	//  https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5
	consola.log("System prompt from frontend: ", system)
	const result = await agent.streamVNext(messages, {
		format: "aisdk",
		memory: {
			thread: threadId,
			resource: `signupAgent-${user.sub}`,
		},
		runtimeContext,
		// @ts-expect-error
		clientTools: tools ? frontendTools(tools) : undefined, // assistant-ui serializes tools and sends them body param "tools"
		// assistant-ui sends additional prompt from frontend in the "system" body param when using `useAssistantInstructions`, adding it here as context
		// NOTE: Not sure that this is working. Agent does not seem to be picking it up.
		context: system
			? [
				{
					role: "system",
					content: `## Context from the client's UI:\n${system}`,
				},
			]
			: undefined,
		onFinish: (data) => {
			consola.log("onFinish", data)
		},
	})

	const langfuse = getLangfuseClient()

	// Return the result as a data stream response
	return result.toUIMessageStreamResponse({
		onFinish: (data) => {
			consola.log("onFinish", data)
			const lfTrace = langfuse.trace?.({ name: "api.signup-agent" })
			const gen = lfTrace?.generation?.({ name: "api.signup-agent", input: data?.messages, output: data?.responseMessage })
			gen?.end?.()
		},
		onError: (err) => {
			consola.error("onError", err)
			return "Failed to generate response. Please try again."
		},
	})
}
