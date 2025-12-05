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
export async function loadLensTemplates(db: SupabaseClient<Database>): Promise<LensTemplate[]> {
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
	interviewId: string,
	accountId?: string
): Promise<Record<string, LensAnalysisWithTemplate>> {
	// Build analyses query - RLS handles access control via account membership
	let analysesQuery = db.from("conversation_lens_analyses").select("*").eq("interview_id", interviewId)

	if (accountId) {
		analysesQuery = analysesQuery.eq("account_id", accountId)
	}

	// Load analyses and templates separately (avoids PostgREST FK detection issues)
	const [analysesResult, templatesResult] = await Promise.all([
		analysesQuery,
		db
			.from("conversation_lens_templates")
			.select("template_key, template_name, summary, category, display_order, template_definition")
			.eq("is_active", true),
	])

	if (analysesResult.error) {
		return {}
	}

	if (templatesResult.error) {
		return {}
	}

	// Build template map for lookup
	const templateMap = new Map<string, LensTemplate>()
	for (const t of templatesResult.data || []) {
		templateMap.set(t.template_key, {
			template_key: t.template_key,
			template_name: t.template_name,
			summary: t.summary,
			category: t.category,
			display_order: t.display_order ?? 100,
			template_definition: t.template_definition as LensTemplate["template_definition"],
		})
	}

	// Convert to map keyed by template_key
	const result: Record<string, LensAnalysisWithTemplate> = {}

	for (const analysis of analysesResult.data || []) {
		const template = templateMap.get(analysis.template_key)
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
			template,
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
	// Load analysis and template separately (avoids PostgREST FK detection issues)
	const [analysisResult, templateResult] = await Promise.all([
		db
			.from("conversation_lens_analyses")
			.select("*")
			.eq("interview_id", interviewId)
			.eq("template_key", templateKey)
			.single(),
		db
			.from("conversation_lens_templates")
			.select("template_key, template_name, summary, category, display_order, template_definition")
			.eq("template_key", templateKey)
			.single(),
	])

	if (analysisResult.error || !analysisResult.data) {
		return null
	}

	if (templateResult.error || !templateResult.data) {
		return null
	}

	const analysis = analysisResult.data
	const t = templateResult.data

	return {
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
			template_key: t.template_key,
			template_name: t.template_name,
			summary: t.summary,
			category: t.category,
			display_order: t.display_order ?? 100,
			template_definition: t.template_definition as LensTemplate["template_definition"],
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
		db.from("conversation_lens_analyses").select("template_key, status").eq("interview_id", interviewId),
		db.from("conversation_lens_templates").select("template_key").eq("is_active", true),
	])

	const completed = (analysesResult.data || []).filter((a) => a.status === "completed").length
	const total = templatesResult.data?.length || 0

	return { completed, total }
}
