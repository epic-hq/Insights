import type { LoaderFunctionArgs } from "react-router"

import { getConversationAnalysisById } from "~/lib/conversation-analyses/db.server"
import { userContext } from "~/server/user-context"

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.supabase || !ctx?.account_id) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		})
	}

	const analysisId = params.analysisId
	if (!analysisId) {
		return new Response(JSON.stringify({ error: "Missing analysis id" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		})
	}

	try {
		const record = await getConversationAnalysisById({ db: ctx.supabase, id: analysisId })
		if (record.account_id !== ctx.account_id) {
			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			})
		}

		return new Response(JSON.stringify({ analysis: record }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		})
	} catch (error) {
		return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to load" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
}
