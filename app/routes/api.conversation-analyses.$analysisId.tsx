import { json, type LoaderFunctionArgs } from "react-router"

import { getConversationAnalysisById } from "~/lib/conversation-analyses/db.server"
import { userContext } from "~/server/user-context"

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	if (!ctx?.supabase || !ctx?.account_id) {
		return json({ error: "Unauthorized" }, { status: 401 })
	}

	const analysisId = params.analysisId
	if (!analysisId) {
		return json({ error: "Missing analysis id" }, { status: 400 })
	}

	try {
		const record = await getConversationAnalysisById({ db: ctx.supabase, id: analysisId })
		if (record.account_id !== ctx.account_id) {
			return json({ error: "Not found" }, { status: 404 })
		}

		return json({ analysis: record })
	} catch (error) {
		return json({ error: error instanceof Error ? error.message : "Failed to load" }, { status: 500 })
	}
}
