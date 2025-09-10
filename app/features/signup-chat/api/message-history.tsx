import { convertMessages } from "@mastra/core/agent"
import type { LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/server"
import { memory } from "~/mastra/memory"

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)

	if (!user) {
		return new Response("Unauthorized", { status: 401 })
	}

	const threads = await memory.getThreadsByResourceIdPaginated({
		resourceId: `signupAgent-${user.sub}`,
		orderBy: "createdAt",
		sortDirection: "DESC",
		page: 0,
		perPage: 100,
	})

	let threadId: string
	if (!(threads?.total > 0)) {
		const newThread = await memory.createThread({
			resourceId: `signupAgent-${user.sub}`,
			title: "Signup Chat",
			metadata: { user_id: user.sub },
		})
		threadId = newThread.id
	} else {
		threadId = threads.threads[0].id
	}

	const { messagesV2 } = await memory.query({
		threadId,
		selectBy: { last: 50 },
	})
	const uiMessages = convertMessages(messagesV2).to("AIV5.UI")

	return new Response(JSON.stringify({ messages: uiMessages }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})
}
