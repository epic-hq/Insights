import type { LoaderFunctionArgs } from "react-router"
import { getAuthenticatedUser } from "~/lib/supabase/client.server"
import { memory } from "~/mastra/memory"

export async function loader({ request }: LoaderFunctionArgs) {
	const user = await getAuthenticatedUser(request)

	if (!user) {
		return new Response("Unauthorized", { status: 401 })
	}

	const threads = await memory.listThreadsByResourceId({
		resourceId: `signupAgent-${user.sub}`,
		orderBy: { field: "createdAt", direction: "DESC" },
		page: 0,
		perPage: 100,
	})

	// Optionally transform thread messages if needed in the future
	// const messages = threads?.items?.flatMap((t: any) => t?.messages ?? []) ?? []

	return new Response(JSON.stringify({ threads }), {
		headers: { "Content-Type": "application/json" },
	})
}
