/**
 * Trigger.dev task for synthesizing cross-interview lens insights
 *
 * Takes all completed lens analyses for a project+template and generates
 * an AI synthesis with key takeaways, patterns, and recommendations.
 */

import { schemaTask } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import { b } from "~/../baml_client"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

const synthesizeLensSummarySchema = z.object({
	projectId: z.string().uuid(),
	templateKey: z.string(),
	accountId: z.string().uuid(),
	customInstructions: z.string().optional(),
	force: z.boolean().optional().default(false),
})

export type SynthesizeLensSummaryPayload = z.infer<typeof synthesizeLensSummarySchema>

// Type definitions for database queries
type TemplateRow = {
	template_key: string
	template_name: string
	template_definition: Record<string, unknown>
	category: string | null
	is_active: boolean
}

type AnalysisRow = {
	id: string
	interview_id: string
	analysis_data: Record<string, unknown>
	confidence_score: number | null
	processed_at: string | null
}

type InterviewRow = {
	id: string
	title: string | null
	participant_pseudonym: string | null
}

type SummaryRow = {
	id: string
	interview_count: number
	processed_at: string | null
	status: string
}

export const synthesizeLensSummaryTask = schemaTask({
	id: "lens.synthesize-summary",
	schema: synthesizeLensSummarySchema,
	retry: {
		maxAttempts: 3,
		factor: 1.8,
		minTimeoutInMs: 1000,
		maxTimeoutInMs: 30_000,
	},
	run: async (payload, { ctx }) => {
		const { projectId, templateKey, accountId, customInstructions, force } = payload
		const client = createSupabaseAdminClient()

		consola.info(`[synthesize-summary] Starting synthesis for project=${projectId}, template=${templateKey}`)

		// 1. Load the template definition
		const { data: template, error: templateError } = (await (client as any)
			.from("conversation_lens_templates")
			.select("template_key, template_name, template_definition, category, is_active")
			.eq("template_key", templateKey)
			.single()) as { data: TemplateRow | null; error: any }

		if (templateError || !template) {
			throw new Error(`Template not found: ${templateKey}`)
		}

		// 2. Load all completed analyses for this project+template (without join to avoid RLS issues)
		const { data: analyses, error: analysesError } = (await (client as any)
			.from("conversation_lens_analyses")
			.select("id, interview_id, analysis_data, confidence_score, processed_at")
			.eq("project_id", projectId)
			.eq("template_key", templateKey)
			.eq("status", "completed")
			.order("processed_at", { ascending: false })) as { data: AnalysisRow[] | null; error: any }

		if (analysesError) {
			throw new Error(`Failed to load analyses: ${analysesError.message}`)
		}

		if (!analyses || analyses.length === 0) {
			consola.info(`[synthesize-summary] No completed analyses found for project=${projectId}, template=${templateKey}`)
			return { status: "no_data", interviewCount: 0 }
		}

		consola.info(`[synthesize-summary] Found ${analyses.length} analyses to synthesize`)

		// 2b. Load interview details separately
		const interviewIds = analyses.map((a) => a.interview_id)
		const { data: interviews } = (await (client as any)
			.from("interviews")
			.select("id, title, participant_pseudonym")
			.in("id", interviewIds)) as { data: InterviewRow[] | null; error: any }

		const interviewMap = new Map<string, InterviewRow>()
		for (const interview of interviews || []) {
			interviewMap.set(interview.id, interview)
		}

		// 3. Check if we need to re-synthesize
		if (!force) {
			const { data: existingSummary } = (await (client as any)
				.from("conversation_lens_summaries")
				.select("id, interview_count, processed_at, status")
				.eq("project_id", projectId)
				.eq("template_key", templateKey)
				.single()) as { data: SummaryRow | null; error: any }

			if (existingSummary && existingSummary.status === "completed" && existingSummary.interview_count === analyses.length) {
				consola.info(`[synthesize-summary] Summary already up-to-date, skipping`)
				return { status: "up_to_date", summaryId: existingSummary.id }
			}
		}

		// 4. Create/update summary record to "processing"
		const { data: summaryRecord, error: upsertError } = (await (client as any)
			.from("conversation_lens_summaries")
			.upsert(
				{
					project_id: projectId,
					template_key: templateKey,
					account_id: accountId,
					status: "processing",
					interview_count: analyses.length,
					custom_instructions: customInstructions,
					trigger_run_id: ctx.run.id,
				},
				{
					onConflict: "project_id,template_key",
				}
			)
			.select("id")
			.single()) as { data: { id: string } | null; error: any }

		if (upsertError || !summaryRecord) {
			throw new Error(`Failed to create summary record: ${upsertError?.message || "Unknown error"}`)
		}

		// 5. Prepare analyses for BAML function
		const analysesJson = JSON.stringify(
			analyses.map((a) => {
				const interview = interviewMap.get(a.interview_id)
				return {
					interview_id: a.interview_id,
					interview_title: interview?.title || "Untitled",
					participant: interview?.participant_pseudonym,
					analysis_data: a.analysis_data,
					confidence_score: a.confidence_score,
				}
			})
		)

		try {
			// 6. Call BAML synthesis function
			consola.info(`[synthesize-summary] Calling SynthesizeLensInsights BAML function`)
			const synthesisResult = await b.SynthesizeLensInsights(
				template.template_name,
				JSON.stringify(template.template_definition),
				analysesJson,
				customInstructions || null
			)

			// 7. Store the synthesis result
			const { error: updateError } = await (client as any)
				.from("conversation_lens_summaries")
				.update({
					synthesis_data: synthesisResult,
					executive_summary: synthesisResult.executive_summary,
					key_takeaways: synthesisResult.key_takeaways,
					recommendations: synthesisResult.recommendations,
					conflicts_to_review: synthesisResult.conflicts_to_review,
					overall_confidence: synthesisResult.overall_confidence,
					interview_count: analyses.length,
					status: "completed",
					processed_at: new Date().toISOString(),
					processed_by: "trigger.dev",
					error_message: null,
				})
				.eq("id", summaryRecord.id)

			if (updateError) {
				throw new Error(`Failed to store synthesis: ${updateError.message}`)
			}

			consola.info(`[synthesize-summary] Successfully synthesized ${analyses.length} analyses for ${templateKey}`)

			return {
				status: "completed",
				summaryId: summaryRecord.id,
				interviewCount: analyses.length,
				keyTakeawaysCount: synthesisResult.key_takeaways.length,
				confidence: synthesisResult.overall_confidence,
			}
		} catch (error: any) {
			// Mark as failed
			await (client as any)
				.from("conversation_lens_summaries")
				.update({
					status: "failed",
					error_message: error?.message || "Unknown error during synthesis",
				})
				.eq("id", summaryRecord.id)

			throw error
		}
	},
})
