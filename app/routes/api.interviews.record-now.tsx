import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createPlannedAnswersForInterview } from "~/lib/database/project-answers.server"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	try {
		if (request.method !== "POST") {
			return new Response(JSON.stringify({ error: "Method not allowed" }), {
				status: 405,
				headers: { "Content-Type": "application/json" },
			})
		}

		const ctx = context.get(userContext)
		const supabase = ctx.supabase
		const accountId = ctx.account_id

		// 1) Create a minimal project
		const now = new Date()
		const projectName = `Quick Interview ${now.toLocaleString()}`
		const { data: project, error: projectError } = await supabase
			.from("projects")
			.insert({ account_id: accountId, name: projectName, description: "Created from Record Now" })
			.select("id")
			.single()

		if (projectError || !project) {
			consola.error("RecordNow: failed to create project", projectError)
			return new Response(JSON.stringify({ error: projectError?.message || "Failed to create project" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			})
		}

		// 2) Create interview in transcribing state for this project
		const title = `${now
			.toLocaleDateString("en-US", { month: "short", day: "numeric" })
			.replace(/ /g, "-")}-${now.toLocaleTimeString()}`
		const { data: interview, error: interviewError } = await supabase
			.from("interviews")
			.insert({
				account_id: accountId,
				project_id: project.id,
				title,
				interview_date: now.toISOString(),
				media_type: "interview",
				status: "transcribing",
			})
			.select("id")
			.single()

		if (interviewError || !interview) {
			consola.error("RecordNow: failed to create interview", interviewError)
			return new Response(JSON.stringify({ error: interviewError?.message || "Failed to create interview" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			})
		}

		await createPlannedAnswersForInterview(supabase, { projectId: project.id, interviewId: interview.id })

		return new Response(JSON.stringify({ projectId: project.id, interviewId: interview.id }), {
			headers: { "Content-Type": "application/json" },
		})
	} catch (e: any) {
		consola.error("RecordNow: unexpected error", e)
		return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		})
	}
}
