// Simple baml v1 analysis, stored in annotations

import { b } from "baml_client"
import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getInsights } from "~/features/insights/db"
import { getInterviews } from "~/features/interviews/db"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server"

interface AnalysisRequest {
	projectId: string
	customInstructions?: string
	analysisVersion?: string
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ error: "Method not allowed" }, { status: 405 })
	}

	try {
		// Get authenticated user
		const { user } = await getAuthenticatedUser(request)
		if (!user) {
			return Response.json({ error: "User not authenticated" }, { status: 401 })
		}

		const body: AnalysisRequest = await request.json()
		const { projectId, customInstructions, analysisVersion = "1.0" } = body

		if (!projectId) {
			return Response.json({ error: "Missing required field: projectId" }, { status: 400 })
		}

		consola.log("Analyzing project status for:", {
			projectId,
			customInstructions,
			analysisVersion,
		})

		// Get supabase client with auth
		const { client: supabase } = getServerClient(request)

		if (!supabase) {
			return Response.json({ error: "Failed to get Supabase client" }, { status: 500 })
		}
		// Get project first to find the account_id (simplified approach)
		const { data: project, error: projectError } = await supabase
			.from("projects")
			.select("*")
			.eq("id", projectId)
			.single()

		// consola.log("Project result:", {
		// 	data: project,
		// 	error: projectError,
		// })

		if (!project) {
			return Response.json({ error: "Project not found" }, { status: 404 })
		}

		// Use the project's account_id for all subsequent operations
		const accountId = project.account_id

		// Fetch interviews and insights using proper database functions
		const { data: interviews, error: interviewsError } = await getInterviews({
			supabase,
			accountId,
			projectId,
		})
		consola.log("Interviews:", {
			interviews: interviews?.length,
			error: interviewsError,
		})

		const { data: insights, error: insightsError } = await getInsights({
			supabase,
			accountId,
			projectId,
		})
		consola.log("Insights:", {
			insights: insights?.length,
			error: insightsError,
		})

		const totalInterviews = interviews?.length || 0
		const totalInsights = insights?.length || 0

		// Allow analysis with just insights if we have enough data
		if (totalInsights === 0) {
			consola.warn("Insufficient data for analysis:", {
				totalInterviews,
				totalInsights,
			})
			return Response.json(
				{
					error: "Insufficient data for analysis",
					details: `Need at least insights (${totalInsights} found)`,
				},
				{ status: 400 }
			)
		}

		// Prepare data for BAML analysis
		const researchGoal = project.research_goal || "Understand user needs"
		const interviewContent =
			interviews
				?.map((i) => `${i.title || "Interview"}: ${i.observations_and_notes || i.high_impact_themes?.join(", ") || ""}`)
				.join("\n\n") || ""
		const insightContent = insights?.map((i) => `${i.name}: ${i.pain || ""} ${i.details || ""}`).join("\n\n") || ""

		// TODO analyze if this is helpful or separate custom instructions
		// Enhanced research goal with custom instructions
		const enhancedGoal = customInstructions
			? `${researchGoal}. Additional analysis requirements: ${customInstructions}`
			: researchGoal

		// consola.log(`analyze-project params goal: ${enhancedGoal}\ninsightContent: ${insightContent}\ninterviewContent: ${interviewContent}\ncustomInstructions: ${customInstructions}`)
		// Run BAML analysis
		const [execsum, projectAnalysis] = await Promise.all([
			b.GenerateExecutiveSummary(enhancedGoal, insightContent, interviewContent, customInstructions || ""),
			b.AnalyzeProjectInsights(enhancedGoal, insightContent, interviewContent, customInstructions || ""),
		])

		// Prepare analysis results with new structure
		const analysisResults = {
			analysis_version: analysisVersion,
			analysis_type: "project_status",
			// Map new BAML fields to expected structure
			answered_questions: projectAnalysis.question_answers?.map((qa) => qa.question) || [],
			open_questions: projectAnalysis.gap_analysis?.unanswered_questions || [],
			completion_score: execsum.completion_percentage,
			// Use new structured insights
			key_insights: execsum.answered_insights || [],
			unanticipated_discoveries: execsum.unanticipated_discoveries || [],
			critical_unknowns: execsum.critical_unknowns || [],
			baml_function: "AnalyzeProjectStatus",
			custom_instructions: customInstructions,
			input_data: {
				total_interviews: totalInterviews,
				total_insights: totalInsights,
				research_goal: researchGoal,
			},
			full_analysis: {
				executive_summary: execsum,
				project_analysis: projectAnalysis,
			},
		}

		// Store as annotation
		const { data: annotation, error: annotationError } = await supabase
			.from("annotations")
			.insert({
				account_id: accountId,
				project_id: projectId,
				entity_type: "project",
				entity_id: projectId,
				annotation_type: "ai_suggestion",
				content: `Project status analysis: ${execsum.completion_percentage}% complete`,
				metadata: analysisResults,
				created_by_user_id: user.id,
				created_by_ai: true,
				ai_model: `AnalyzeProjectStatus-v${analysisVersion}`,
				status: "active",
				visibility: "team",
			})
			.select()
			.single()

		if (annotationError) {
			consola.error("Failed to store analysis annotation:", annotationError)
			return Response.json({ error: "Failed to store analysis results" }, { status: 500 })
		}

		consola.log("✅ Project status analysis completed and stored:", annotation.id)

		return Response.json({
			success: true,
			analysisId: annotation.id,
			results: analysisResults,
		})
	} catch (error) {
		consola.error("Failed to analyze project status:", error)
		return Response.json(
			{
				error: "Failed to analyze project status",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
