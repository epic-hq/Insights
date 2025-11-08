import consola from "consola"
import type { LoaderFunctionArgs } from "react-router"
import { memory } from "~/mastra/memory"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { userContext } from "~/server/user-context"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const projectId = String(params.projectId || "")
	const userId = ctx?.claims?.sub || ""

	if (!projectId) {
		return Response.json({ error: "Missing projectId" }, { status: 400 })
	}

	try {
		const resourceId = `projectStatusAgent-${userId}-${projectId}`

		// Get the most recent thread for this project
		const threads = await memory.getThreadsByResourceIdPaginated({
			resourceId,
			orderBy: "createdAt",
			sortDirection: "DESC",
			page: 0,
			perPage: 1,
		})

		if (!threads?.total || threads.total === 0) {
			return Response.json({ messages: [] })
		}

		const threadId = threads.threads[0].id

		// Query messages directly from database
		// biome-ignore lint/suspicious/noExplicitAny: Mastra schema not in Database types
		const { data: messages, error } = await (supabaseAdmin as any)
			.schema("mastra")
			.from("messages")
			.select("*")
			.eq("thread_id", threadId)
			.order("created_at", { ascending: true })

		if (error) {
			consola.error("Error fetching messages from database:", error)
			return Response.json({ messages: [] })
		}

		consola.info("project-status history loaded", {
			threadId,
			messageCount: messages?.length || 0,
		})

		return Response.json({
			threadId,
			messages: messages || [],
		})
	} catch (error) {
		consola.error("Error loading project status chat history:", error)
		return Response.json({ error: "Failed to load chat history" }, { status: 500 })
	}
}
