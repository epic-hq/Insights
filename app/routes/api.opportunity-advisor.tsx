import { b } from "baml_client"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { createOpportunityAdvice, getLatestAISuggestion } from "~/features/annotations/db"
import { getServerClient } from "~/lib/supabase/client.server"
import { userContext } from "~/server/user-context"

export async function action({ request, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const userId = ctx.userId
	consola.info("🚀 Opportunity Advisor API called")
	const formData = await request.formData()
	const opportunityId = formData.get("opportunityId")?.toString()
	const accountId = formData.get("accountId")?.toString()
	const projectId = formData.get("projectId")?.toString()

	consola.info("Parameters:", { opportunityId, accountId, projectId })

	if (!opportunityId || !accountId || !projectId) {
		consola.error("Missing required parameters")
		return Response.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
	}

	const { client: supabase } = getServerClient(request)

	try {
		// Fetch opportunity data
		const { data: opportunity, error: oppError } = await supabase
			.from("opportunities")
			.select("*")
			.eq("id", opportunityId)
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.single()

		if (oppError || !opportunity) {
			return Response.json({ ok: false, error: "Opportunity not found" }, { status: 404 })
		}

		// Fetch sales lens data
		const { data: summaries } = await supabase
			.from("sales_lens_summaries")
			.select("id")
			.eq("opportunity_id", opportunityId)
			.eq("account_id", accountId)
			.eq("project_id", projectId)

		const summaryIds = summaries?.map((s) => s.id) || []

		// Fetch stakeholders
		let stakeholders: any[] = []
		if (summaryIds.length > 0) {
			const { data: stakeholdersData } = await supabase
				.from("sales_lens_stakeholders")
				.select("*")
				.in("summary_id", summaryIds)

			stakeholders = stakeholdersData || []
		}

		// Fetch next steps (from sales_lens_slots)
		let nextSteps: any[] = []
		if (summaryIds.length > 0) {
			const { data: slotsData } = await supabase.from("sales_lens_slots").select("*").in("summary_id", summaryIds)

			const slots = slotsData || []
			nextSteps = slots
				.filter((slot) => {
					const slotKey = slot.slot?.toLowerCase() || ""
					return slotKey.includes("milestone") || slotKey.includes("next") || slotKey.includes("step")
				})
				.map((slot) => ({
					description: slot.text_value || slot.description || "Next step",
					dueDate: slot.date_value,
				}))
		}

		// Fetch linked interviews
		let linkedInterviews: any[] = []
		if (summaryIds.length > 0) {
			const { data: interviewsData } = await supabase
				.from("sales_lens_summaries")
				.select("interview_id")
				.in("id", summaryIds)
				.not("interview_id", "is", null)

			const interviewIds = [...new Set(interviewsData?.map((s) => s.interview_id).filter(Boolean) || [])]

			if (interviewIds.length > 0) {
				const { data: interviews } = await supabase
					.from("interviews")
					.select("id, title, interview_date")
					.in("id", interviewIds)

				linkedInterviews = interviews || []
			}
		}

		// Prepare data for BAML function
		const metadata = (opportunity.metadata as any) || {}
		const productDescription = metadata.product_description || ""
		const notes = metadata.notes || ""

		const stakeholdersJson = JSON.stringify(
			stakeholders.map((s) => ({
				name: s.display_name,
				role: s.role,
				influence: s.influence,
				type: s.labels?.find((l: string) => ["DM", "I", "B"].includes(l)),
			})),
			null,
			2
		)

		const nextStepsJson = JSON.stringify(
			nextSteps.map((ns) => ({
				description: ns.description,
				dueDate: ns.dueDate,
			})),
			null,
			2
		)

		const interviewsJson = JSON.stringify(
			linkedInterviews.map((i) => ({
				title: i.title,
				date: i.interview_date,
			})),
			null,
			2
		)

		// Call BAML function
		consola.info("Calling AnalyzeOpportunity BAML function", { opportunityId, title: opportunity.title })

		const recommendation = await b.AnalyzeOpportunity(
			opportunity.title,
			opportunity.stage || undefined,
			opportunity.amount ? opportunity.amount.toString() : undefined,
			opportunity.close_date || undefined,
			productDescription || undefined,
			notes || undefined,
			stakeholdersJson,
			nextStepsJson,
			interviewsJson
		)

		consola.info("Received recommendation", recommendation)

		// Check for existing recommendation to supersede
		const previousRecommendation = await getLatestAISuggestion({
			supabase,
			accountId,
			projectId,
			entityType: "opportunity",
			entityId: opportunityId,
			suggestionType: "opportunity_advice",
		})

		// Store recommendation using typed helper function
		const { data: annotation, error: annotationError } = await createOpportunityAdvice({
			supabase,
			accountId,
			projectId,
			opportunityId,
			statusAssessment: recommendation.status_assessment,
			recommendations: recommendation.recommendations,
			risks: recommendation.risks,
			confidence: recommendation.confidence as "high" | "medium" | "low",
			aiModel: "gpt-4o",
			createdByUserId: userId, // Track which user triggered the AI generation
			context: {
				stakeholder_count: stakeholders.length,
				next_steps_count: nextSteps.length,
				interviews_analyzed: linkedInterviews.length,
			},
			supersedesAnnotationId: previousRecommendation?.id,
		})

		if (annotationError) {
			consola.error("Failed to store annotation", annotationError)
			return Response.json({ ok: false, error: "Failed to store recommendation" }, { status: 500 })
		}

		if (!annotation) {
			consola.error("No annotation returned from createOpportunityAdvice")
			return Response.json({ ok: false, error: "Failed to create recommendation" }, { status: 500 })
		}

		return Response.json({
			ok: true,
			recommendation: {
				id: annotation.id,
				status_assessment: recommendation.status_assessment,
				recommendations: recommendation.recommendations,
				risks: recommendation.risks,
				confidence: recommendation.confidence,
				created_at: annotation.created_at,
			},
		})
	} catch (error) {
		consola.error("Failed to generate opportunity advisor recommendation", error)
		return Response.json(
			{
				ok: false,
				error: "Failed to generate recommendation",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
