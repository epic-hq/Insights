/**
 * Apply a single conversation lens to an interview
 *
 * Wrapper that calls the appropriate BAML extraction function based on template_key,
 * then stores the result in conversation_lens_analyses.
 */

import { task } from "@trigger.dev/sdk"
import consola from "consola"

import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { workflowRetryConfig } from "~/utils/processInterview.server"

export type ApplyLensPayload = {
	interviewId: string
	templateKey: string
	accountId: string
	projectId?: string | null
	computedBy?: string | null
}

type EvidenceForLens = {
	id: string
	gist: string | null
	verbatim: string | null
	chunk: string | null
	start_ms: number | null
	end_ms: number | null
	facet_mentions: any[] | null
}

/**
 * Build interview context string for BAML prompts
 */
function buildInterviewContext(interview: {
	title?: string | null
	interview_date?: string | null
	duration_sec?: number | null
}): string {
	const parts: string[] = []
	if (interview.title) parts.push(`Title: ${interview.title}`)
	if (interview.interview_date) parts.push(`Date: ${interview.interview_date}`)
	if (interview.duration_sec) parts.push(`Duration: ${Math.round(interview.duration_sec / 60)} minutes`)
	return parts.join("\n") || "No context available"
}

/**
 * Build project context for project-research lens
 */
function buildProjectContext(project: {
	project_goals?: string[] | null
	decision_questions?: string[] | null
	unknowns?: string[] | null
	target_orgs?: string[] | null
	target_roles?: string[] | null
} | null): {
	goals: string
	decisionQuestions: string
	unknowns: string
	targetOrgs: string
	targetRoles: string
} | null {
	if (!project) return null

	return {
		goals: project.project_goals?.join("\n") || "No goals defined",
		decisionQuestions: project.decision_questions?.join("\n") || "No decision questions defined",
		unknowns: project.unknowns?.join("\n") || "No unknowns defined",
		targetOrgs: project.target_orgs?.join("\n") || "No target organizations defined",
		targetRoles: project.target_roles?.join("\n") || "No target roles defined",
	}
}

/**
 * Apply the appropriate BAML extraction based on template key
 */
async function extractWithBAML(
	templateKey: string,
	evidenceJson: string,
	interviewContext: string,
	projectContext: ReturnType<typeof buildProjectContext>
): Promise<any> {
	switch (templateKey) {
		case "project-research":
			if (!projectContext) {
				consola.warn(`[applyLens] No project context for project-research lens, skipping`)
				return null
			}
			return await b.ExtractGoalLens(
				evidenceJson,
				interviewContext,
				projectContext.goals,
				projectContext.decisionQuestions,
				projectContext.unknowns,
				projectContext.targetOrgs,
				projectContext.targetRoles
			)

		case "sales-bant":
			return await b.ExtractSalesLensBant(evidenceJson, interviewContext)

		case "product-insights":
			return await b.ExtractProductLens(evidenceJson, interviewContext)

		case "user-testing":
			return await b.ExtractResearchLens(evidenceJson, interviewContext)

		case "customer-discovery":
		case "empathy-map-jtbd":
			// These use the generic template structure - for now, skip BAML
			// and let evidence extraction handle empathy map fields
			consola.info(`[applyLens] Template ${templateKey} uses evidence-based extraction`)
			return null

		default:
			consola.warn(`[applyLens] Unknown template key: ${templateKey}`)
			return null
	}
}

/**
 * Transform BAML extraction result to generic analysis_data format
 */
function transformToAnalysisData(templateKey: string, extraction: any): any {
	if (!extraction) return { sections: [], entities: {}, recommendations: [] }

	// Each BAML function returns a different structure, normalize here
	switch (templateKey) {
		case "project-research":
			return {
				sections: [
					{
						section_key: "goal_answers",
						items: extraction.goal_answers || [],
					},
					{
						section_key: "decision_insights",
						items: extraction.decision_insights || [],
					},
					{
						section_key: "unknown_resolutions",
						items: extraction.unknown_resolutions || [],
					},
					{
						section_key: "target_fit",
						items: extraction.target_fit || [],
					},
				],
				entities: {},
				recommendations: extraction.recommended_follow_ups?.map((r: string) => ({
					type: "follow_up",
					description: r,
					priority: "medium",
				})) || [],
				goal_completion_score: extraction.goal_completion_score,
				research_learnings: extraction.research_learnings || [],
			}

		case "sales-bant":
			return {
				sections: [
					{
						section_key: "bant",
						items: [
							{ field_key: "budget", ...extraction.budget },
							{ field_key: "authority", ...extraction.authority },
							{ field_key: "need", ...extraction.need },
							{ field_key: "timeline", ...extraction.timeline },
						],
					},
				],
				entities: {
					stakeholders: extraction.stakeholders || [],
					next_steps: extraction.next_steps || [],
				},
				recommendations: extraction.deal_qualification?.recommended_actions?.map((a: string) => ({
					type: "next_step",
					description: a,
					priority: "high",
				})) || [],
				deal_qualification: extraction.deal_qualification,
				key_insights: extraction.key_insights || [],
				risks_and_concerns: extraction.risks_and_concerns || [],
			}

		case "product-insights":
			return {
				sections: [
					{
						section_key: "jobs_to_be_done",
						items: extraction.jobs || [],
					},
					{
						section_key: "feature_requests",
						items: extraction.feature_requests || [],
					},
					{
						section_key: "product_gaps",
						items: extraction.product_gaps || [],
					},
				],
				entities: {
					competitive_insights: extraction.competitive_insights || [],
				},
				recommendations: [],
				feature_priorities: extraction.feature_priorities || [],
				key_insights: extraction.key_insights || [],
			}

		case "user-testing":
			return {
				sections: [
					{
						section_key: "usability_findings",
						items: extraction.usability_findings || [],
					},
					{
						section_key: "journey_insights",
						items: extraction.journey_insights || [],
					},
					{
						section_key: "behavior_patterns",
						items: extraction.behavior_patterns || [],
					},
				],
				entities: {
					mental_models: extraction.mental_models || [],
				},
				recommendations: extraction.recommended_next_research?.map((r: string) => ({
					type: "research",
					description: r,
					priority: "medium",
				})) || [],
				hypothesis_validations: extraction.hypothesis_validations || [],
				key_learnings: extraction.key_learnings || [],
			}

		default:
			return { sections: [], entities: {}, recommendations: [] }
	}
}

/**
 * Calculate overall confidence from extraction
 */
function calculateOverallConfidence(templateKey: string, extraction: any): number {
	if (!extraction) return 0

	switch (templateKey) {
		case "project-research":
			return extraction.goal_completion_score || 0.5

		case "sales-bant": {
			const scores = [
				extraction.budget?.confidence,
				extraction.authority?.confidence,
				extraction.need?.confidence,
				extraction.timeline?.confidence,
			].filter((s): s is number => typeof s === "number")
			return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
		}

		case "product-insights":
		case "user-testing":
			return 0.7 // Default for these lens types

		default:
			return 0.5
	}
}

export const applyLensTask = task({
	id: "lens.apply-lens",
	retry: workflowRetryConfig,
	run: async (payload: ApplyLensPayload) => {
		const { interviewId, templateKey, accountId, projectId, computedBy } = payload
		const client = createSupabaseAdminClient()

		consola.info(`[applyLens] Applying ${templateKey} to interview ${interviewId}`)

		// Load interview with project context
		type InterviewWithProject = {
			id: string
			title: string | null
			interview_date: string | null
			duration_sec: number | null
			lens_visibility: string | null
			projects: {
				id: string
				project_goals: any | null
				decision_questions: any | null
				unknowns: any | null
				target_orgs: any | null
				target_roles: any | null
			} | null
		}

		const { data: interview, error: interviewError } = await (client as any)
			.from("interviews")
			.select(`
				id, title, interview_date, duration_sec, lens_visibility,
				projects (
					id, project_goals, decision_questions, unknowns, target_orgs, target_roles
				)
			`)
			.eq("id", interviewId)
			.single() as { data: InterviewWithProject | null; error: any }

		if (interviewError || !interview) {
			throw new Error(`Interview not found: ${interviewId}`)
		}

		// Skip if private
		if (interview.lens_visibility === "private") {
			consola.info(`[applyLens] Skipping private interview ${interviewId}`)
			return { skipped: true, reason: "private" }
		}

		// Load evidence
		type EvidenceRow = {
			id: string
			gist: string | null
			verbatim: string | null
			chunk: string | null
			start_ms: number | null
			end_ms: number | null
			facet_mentions: any | null
		}

		const { data: evidence, error: evidenceError } = await (client as any)
			.from("evidence")
			.select("id, gist, verbatim, chunk, start_ms, end_ms, facet_mentions")
			.eq("interview_id", interviewId)
			.order("start_ms", { ascending: true }) as { data: EvidenceRow[] | null; error: any }

		if (evidenceError) {
			throw new Error(`Failed to load evidence: ${evidenceError.message}`)
		}

		if (!evidence || evidence.length === 0) {
			consola.warn(`[applyLens] No evidence for interview ${interviewId}, storing empty analysis`)
			// Store empty result
			await (client as any).from("conversation_lens_analyses").upsert(
				{
					interview_id: interviewId,
					template_key: templateKey,
					account_id: accountId,
					project_id: projectId,
					analysis_data: { sections: [], entities: {}, recommendations: [] },
					confidence_score: 0,
					auto_detected: true,
					status: "completed",
					processed_at: new Date().toISOString(),
					processed_by: computedBy,
				},
				{ onConflict: "interview_id,template_key" }
			)
			return { templateKey, success: true, evidenceCount: 0 }
		}

		const evidenceJson = JSON.stringify(evidence)
		const interviewContext = buildInterviewContext(interview)
		const projectContext = buildProjectContext(interview.projects as any)

		// Run BAML extraction
		let extraction: any = null
		try {
			extraction = await extractWithBAML(templateKey, evidenceJson, interviewContext, projectContext)
		} catch (error) {
			consola.error(`[applyLens] BAML extraction failed for ${templateKey}:`, error)
			// Store failed status
			await (client as any).from("conversation_lens_analyses").upsert(
				{
					interview_id: interviewId,
					template_key: templateKey,
					account_id: accountId,
					project_id: projectId,
					analysis_data: {},
					confidence_score: 0,
					auto_detected: true,
					status: "failed",
					error_message: error instanceof Error ? error.message : String(error),
					processed_at: new Date().toISOString(),
					processed_by: computedBy,
				},
				{ onConflict: "interview_id,template_key" }
			)
			throw error
		}

		// Transform and store result
		const analysisData = transformToAnalysisData(templateKey, extraction)
		const confidenceScore = calculateOverallConfidence(templateKey, extraction)

		const { error: upsertError } = await (client as any).from("conversation_lens_analyses").upsert(
			{
				interview_id: interviewId,
				template_key: templateKey,
				account_id: accountId,
				project_id: projectId,
				analysis_data: analysisData,
				confidence_score: confidenceScore,
				auto_detected: true,
				status: "completed",
				processed_at: new Date().toISOString(),
				processed_by: computedBy,
			},
			{ onConflict: "interview_id,template_key" }
		)

		if (upsertError) {
			throw new Error(`Failed to store analysis: ${upsertError.message}`)
		}

		consola.success(`[applyLens] ✓ Applied ${templateKey} to ${interviewId} (confidence: ${confidenceScore.toFixed(2)})`)

		return {
			templateKey,
			success: true,
			evidenceCount: evidence.length,
			confidenceScore,
		}
	},
})
