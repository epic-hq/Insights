import type { ActionFunctionArgs } from "react-router"
import { getProjectContextGeneric } from "~/features/questions/db"
import { runBamlWithBilling, userBillingContext } from "~/lib/billing"
import { getLangfuseClient } from "~/lib/langfuse.server"
import { getServerClient } from "~/lib/supabase/client.server"

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}
	const langfuse = getLangfuseClient()
	const lfTrace = (langfuse as any).trace?.({ name: "api.improve-question" })
	try {
		// Get user from request
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub || "anonymous"

		const { question, project_id } = await request.json()
		if (!question || typeof question !== "string") {
			return Response.json({ error: "Missing question" }, { status: 400 })
		}

		let research_context = "General interview planning context"
		if (project_id) {
			try {
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

		const billingCtx = userBillingContext(accountId, accountId, "question_improvement")

		// Prefer GPT‑4o‑mini for rewrite variety (friendlier + examples)
		let primary: string | null = null
		try {
			const { result: batch } = await runBamlWithBilling(
				billingCtx,
				{
					functionName: "EvaluateQuestionSet",
					traceName: "baml.evaluate-question-set.single",
					bamlCall: (client) => client.EvaluateQuestionSet([question], research_context),
					resourceType: "question",
				},
				`improve-question:${accountId}:${question.slice(0, 30)}:${Date.now()}`
			)
			primary = batch?.evaluations?.[0]?.improvement?.suggested_rewrite || null
		} catch (err) {
			console.warn("EvaluateQuestionSet failed, falling back:", err)
			const { result: evalResult } = await runBamlWithBilling(
				billingCtx,
				{
					functionName: "EvaluateInterviewQuestion",
					traceName: "baml.evaluate-interview-question",
					bamlCall: (client) => client.EvaluateInterviewQuestion(question, research_context),
					resourceType: "question",
				},
				`improve-question-fallback:${accountId}:${question.slice(0, 30)}:${Date.now()}`
			)
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
	} catch (_error) {
		return Response.json({ error: "Failed to improve question" }, { status: 500 })
	} finally {
		lfTrace?.end?.()
	}
}

export const POST = action
