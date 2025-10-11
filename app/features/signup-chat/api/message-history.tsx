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

	// Optionally transform thread messages if needed in the future
	// const messages = threads?.items?.flatMap((t: any) => t?.messages ?? []) ?? []

	return new Response(JSON.stringify({ threads }), {
		headers: { "Content-Type": "application/json" },
	})
}
