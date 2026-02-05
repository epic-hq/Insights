import consola from "consola"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { runBamlWithBilling, userBillingContext } from "~/lib/billing"
import { getServerClient } from "~/lib/supabase/client.server"
import { aggregateAutoInsightsData, formatDataForLLM } from "~/utils/autoInsightsData.server"

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	try {
		// Check if we have enough data for meaningful insights
		const [insightsCount, interviewsCount] = await Promise.all([
			supabase.from("themes").select("id", { count: "exact", head: true }).eq("account_id", accountId),
			supabase.from("interviews").select("id", { count: "exact", head: true }).eq("account_id", accountId),
		])

		const hasMinimumData = (insightsCount.count || 0) >= 5 && (interviewsCount.count || 0) >= 2

		return {
			hasMinimumData,
			insightsCount: insightsCount.count || 0,
			interviewsCount: interviewsCount.count || 0,
			message: hasMinimumData
				? "Ready to generate auto-insights"
				: "Need at least 5 insights from 2+ interviews for meaningful analysis",
		}
	} catch (error) {
		consola.error("Error checking auto-insights readiness:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}

export async function action({ request }: ActionFunctionArgs) {
	try {
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub

		consola.log("[AUTO-INSIGHTS API] Starting action...")

		if (!accountId) {
			consola.error("[AUTO-INSIGHTS API] User not authenticated")
			throw new Response("Unauthorized", { status: 401 })
		}

		if (!accountId) {
			consola.error("[AUTO-INSIGHTS API] Account ID not found in user claims")
			throw new Response("Account ID not found", { status: 400 })
		}

		const formData = await request.formData()
		const action = formData.get("action") as string

		if (action === "generate") {
			// Get optional parameters
			const competitiveContext =
				(formData.get("competitive_context") as string) ||
				"Analyze competitive landscape based on available data and industry context."

			const businessGoals =
				(formData.get("business_goals") as string) ||
				"Maximize user value, improve product-market fit, and identify revenue opportunities."

			// 1. Aggregate all user research data
			const aggregatedData = await aggregateAutoInsightsData(request, accountId)

			// 2. Format data for LLM consumption
			const formattedData = formatDataForLLM(aggregatedData)

			// 3. Generate insights using BAML
			const billingCtx = userBillingContext(
				accountId,
				accountId, // userId same as accountId for server-side
				"auto_insights"
			)

			const { result: autoInsights } = await runBamlWithBilling(
				billingCtx,
				{
					functionName: "GenerateAutoInsights",
					traceName: "baml.generate-auto-insights",
					bamlCall: (client) => client.GenerateAutoInsights(formattedData, competitiveContext, businessGoals),
					resourceType: "auto_insight",
				},
				`auto-insights:${accountId}:${Date.now()}`
			)

			consola.info(
				`Auto-insights generated: ${autoInsights.critical_insights?.length || 0} insights, ${autoInsights.top_opportunities?.length || 0} opportunities`
			)

			return {
				success: true,
				data: autoInsights,
				metadata: {
					generated_at: new Date().toISOString(),
					account_id: accountId,
					data_summary: aggregatedData.summary,
				},
			}
		}

		if (action === "execute_action") {
			const actionType = formData.get("action_type") as string
			const parameters = JSON.parse((formData.get("parameters") as string) || "{}")

			// TODO: Implement actual creation logic once database client is properly configured
			return {
				success: true,
				type: actionType,
				message: `${actionType} execution will be implemented once backend integration is complete.`,
				data: parameters,
			}
		}

		throw new Response("Invalid action", { status: 400 })
	} catch (error) {
		consola.error("[AUTO-INSIGHTS API] Error:", error)
		throw new Response("Internal server error", { status: 500 })
	}
}
