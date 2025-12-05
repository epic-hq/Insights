/**
 * Server-side loaders for conversation lens analyses
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/types/supabase.types"

export type LensTemplate = {
	template_key: string
	template_name: string
	summary: string | null
	category: string | null
	display_order: number
	template_definition: {
		sections: Array<{
			section_key: string
			section_name: string
			description?: string
			fields: Array<{
				field_key: string
				field_name: string
				field_type: "text" | "text_array" | "numeric" | "date" | "boolean"
				description?: string
			}>
		}>
		entities?: string[]
		recommendations_enabled?: boolean
		requires_project_context?: boolean
	}
}

export type LensAnalysis = {
	id: string
	interview_id: string
	template_key: string
	analysis_data: any
	confidence_score: number | null
	status: "pending" | "processing" | "completed" | "failed"
	error_message: string | null
	processed_at: string | null
	created_at: string
}

export type LensAnalysisWithTemplate = LensAnalysis & {
	template: LensTemplate
}

/**
 * Load all available lens templates
 */
export async function loadLensTemplates(
	db: SupabaseClient<Database>
): Promise<LensTemplate[]> {
	const { data, error } = await db
		.from("conversation_lens_templates")
		.select("*")
		.eq("is_active", true)
		.order("display_order", { ascending: true })

	if (error) {
		console.error("[loadLensTemplates] Error:", error)
		return []
	}

	return (data || []).map((t) => ({
		template_key: t.template_key,
		template_name: t.template_name,
		summary: t.summary,
		category: t.category,
		display_order: t.display_order ?? 100,
		template_definition: t.template_definition as LensTemplate["template_definition"],
	}))
}

/**
 * Load all lens analyses for an interview
 */
export async function loadLensAnalyses(
	db: SupabaseClient<Database>,
	interviewId: string
): Promise<Record<string, LensAnalysisWithTemplate>> {
	const { data, error } = await db
		.from("conversation_lens_analyses")
		.select(`
			*,
			conversation_lens_templates (
				template_key,
				template_name,
				summary,
				category,
				display_order,
				template_definition
			)
		`)
		.eq("interview_id", interviewId)

	if (error) {
		console.error("[loadLensAnalyses] Error:", error)
		return {}
	}

	// Convert to map keyed by template_key
	const result: Record<string, LensAnalysisWithTemplate> = {}

	for (const analysis of data || []) {
		const template = analysis.conversation_lens_templates as any
		if (!template) continue

		result[analysis.template_key] = {
			id: analysis.id,
			interview_id: analysis.interview_id,
			template_key: analysis.template_key,
			analysis_data: analysis.analysis_data,
			confidence_score: analysis.confidence_score,
			status: analysis.status as LensAnalysis["status"],
			error_message: analysis.error_message,
			processed_at: analysis.processed_at,
			created_at: analysis.created_at,
			template: {
				template_key: template.template_key,
				template_name: template.template_name,
				summary: template.summary,
				category: template.category,
				display_order: template.display_order ?? 100,
				template_definition: template.template_definition,
			},
		}
	}

	return result
}

/**
 * Load a single lens analysis by interview and template key
 */
export async function loadLensAnalysis(
	db: SupabaseClient<Database>,
	interviewId: string,
	templateKey: string
): Promise<LensAnalysisWithTemplate | null> {
	const { data, error } = await db
		.from("conversation_lens_analyses")
		.select(`
			*,
			conversation_lens_templates (
				template_key,
				template_name,
				summary,
				category,
				display_order,
				template_definition
			)
		`)
		.eq("interview_id", interviewId)
		.eq("template_key", templateKey)
		.single()

	if (error || !data) {
		return null
	}

	const template = data.conversation_lens_templates as any
	if (!template) return null

	return {
		id: data.id,
		interview_id: data.interview_id,
		template_key: data.template_key,
		analysis_data: data.analysis_data,
		confidence_score: data.confidence_score,
		status: data.status as LensAnalysis["status"],
		error_message: data.error_message,
		processed_at: data.processed_at,
		created_at: data.created_at,
		template: {
			template_key: template.template_key,
			template_name: template.template_name,
			summary: template.summary,
			category: template.category,
			display_order: template.display_order ?? 100,
			template_definition: template.template_definition,
		},
	}
}

/**
 * Get completed lens count for an interview
 */
export async function getLensAnalysisCount(
	db: SupabaseClient<Database>,
	interviewId: string
): Promise<{ completed: number; total: number }> {
	const [analysesResult, templatesResult] = await Promise.all([
		db
			.from("conversation_lens_analyses")
			.select("template_key, status")
			.eq("interview_id", interviewId),
		db
			.from("conversation_lens_templates")
			.select("template_key")
			.eq("is_active", true),
	])

	const completed = (analysesResult.data || []).filter((a) => a.status === "completed").length
	const total = templatesResult.data?.length || 0

	return { completed, total }
}
