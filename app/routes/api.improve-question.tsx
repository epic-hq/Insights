import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { getServerClient } from "~/lib/supabase/server"
import { runBamlWithTracing } from "~/lib/baml/runBamlWithTracing.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({ name: "api.improve-question" })
	try {
		const { question, project_id } = await request.json()
		if (!question || typeof question !== "string") {
			return Response.json({ error: "Missing question" }, { status: 400 })
		}

		let research_context = "General interview planning context"
		if (project_id) {
			try {
				const { client: supabase } = getServerClient(request)
				const ctx = await getProjectContextGeneric(supabase, project_id as string)
				const meta: any = ctx?.merged || {}
				const orgs = Array.isArray(meta.target_orgs) ? meta.target_orgs.join(", ") : meta.target_orgs || ""
				const roles = Array.isArray(meta.target_roles) ? meta.target_roles.join(", ") : meta.target_roles || ""
				const goal = meta.research_goal || ""
				const details = meta.research_goal_details || ""
				research_context = `Target orgs: ${orgs}\nRoles: ${roles}\nGoal: ${goal}\nDetails: ${details}`.trim()
			} catch {
				// ignore context failure
			}
		}

		// Prefer GPT‑4o‑mini for rewrite variety (friendlier + examples)
		let primary: string | null = null
		try {
			const { result: batch } = await runBamlWithTracing({
				functionName: "EvaluateQuestionSet",
				traceName: "baml.evaluate-question-set.single",
				input: { question, research_context },
				metadata: { route: "api.improve-question" },
				logUsageLabel: "EvaluateQuestionSet",
				bamlCall: (client) => client.EvaluateQuestionSet([question], research_context),
			})
			primary = batch?.evaluations?.[0]?.improvement?.suggested_rewrite || null
		} catch (err) {
			console.warn("EvaluateQuestionSet failed, falling back:", err)
			const { result: evalResult } = await runBamlWithTracing({
				functionName: "EvaluateInterviewQuestion",
				traceName: "baml.evaluate-interview-question",
				input: { question, research_context },
				metadata: { route: "api.improve-question" },
				logUsageLabel: "EvaluateInterviewQuestion",
				bamlCall: (client) => client.EvaluateInterviewQuestion(question, research_context),
			})
			primary = evalResult?.improvement?.suggested_rewrite || null
		}

		// Provide up to 3 options (primary + open‑ended variants with context)
		const base = primary || question
		const options: string[] = []
		if (primary) options.push(primary)
		options.push(`Tell me about the last time ${base.replace(/^(how|what)\s+do\s+you\s+/i, "you ")}`)
		options.push(`Walk me through your process when ${base.replace(/^(what|how)\s+do\s+you\s+do\s+when\s+/i, "")}`)

		// Deduplicate and limit
		const unique = Array.from(new Set(options.filter(Boolean))).slice(0, 3)

		return Response.json({ success: true, options: unique })
	} catch (error) {
		return Response.json({ error: "Failed to improve question" }, { status: 500 })
	} finally {
		lfTrace?.end?.()
	}
}

export const POST = action
