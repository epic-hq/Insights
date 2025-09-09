import { ActionFunctionArgs } from "react-router";
import { mastra } from "~/mastra";
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server";
import { Memory } from "@mastra/memory"
import { getSharedPostgresStore } from "~/mastra/storage/postgres-singleton"
import consola from "consola";

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

	const { messages } = await request.json()
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

	 // Get the chefAgent instance from Mastra
	 const agent = mastra.getAgent("signupAgent");
	 // Stream the response using the agent
	 //  NOTE: ON AI SDK V5
	 //  https://mastra.ai/en/docs/frameworks/agentic-uis/ai-sdk#vercel-ai-sdk-v5
	 const result = await agent.streamVNext(messages, {
		format: 'aisdk',
		resourceId: `signupAgent-${user.sub}`,
		threadId: threadId,
	 });

	 // Return the result as a data stream response
	 return result.toUIMessageStreamResponse();
}
