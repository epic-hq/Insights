import type { ActionFunctionArgs } from "@remix-run/node"
import { json } from "@remix-run/node"
import { createSupabaseServerClient } from "~/lib/supabase/server"
import { refreshInterviewQuestions } from "~/lib/database/project-answers.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		const formData = await request.formData()
		const projectId = formData.get("projectId") as string
		const interviewId = formData.get("interviewId") as string

		if (!projectId || !interviewId) {
			return json({ error: "Missing projectId or interviewId" }, { status: 400 })
		}

		const supabase = createSupabaseServerClient(request)
		
		// Refresh the interview questions to sync with current interview_prompts
		await refreshInterviewQuestions(supabase, { projectId, interviewId })

		return json({ success: true })
	} catch (error) {
		console.error("Error refreshing interview questions:", error)
		return json({ error: "Failed to refresh interview questions" }, { status: 500 })
	}
}
