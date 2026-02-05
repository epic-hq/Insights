import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

/**
 * Conversation Lens Tool - Search and retrieve conversation lens templates and analyses
 *
 * Conversation lenses are analytical frameworks for extracting structured insights from interviews:
 * - Project Research: Answer project goals, decision questions, unknowns
 * - Customer Discovery: Validate problem-solution fit
 * - User Testing: Evaluate usability and UX
 * - Product Insights: Extract JTBD, feature requests, competitive intel
 * - Sales BANT: Qualify opportunities (Budget, Authority, Need, Timeline)
 * - Empathy Map / JTBD: Understand user motivations and emotional drivers
 */

// Zod schemas for type-safe outputs
const lensTemplateSchema = z.object({
	templateKey: z.string(),
	templateName: z.string(),
	summary: z.string().nullable(),
	category: z.string().nullable(),
	displayOrder: z.number(),
	primaryObjective: z.string().nullable(),
	sections: z.array(
		z.object({
			sectionKey: z.string(),
			sectionName: z.string(),
			description: z.string().optional(),
			fields: z.array(
				z.object({
					fieldKey: z.string(),
					fieldName: z.string(),
					fieldType: z.enum(["text", "text_array", "numeric", "date", "boolean"]),
					description: z.string().optional(),
				})
			),
		})
	),
	requiresProjectContext: z.boolean().optional(),
	recommendationsEnabled: z.boolean().optional(),
})

const lensAnalysisSchema = z.object({
	id: z.string(),
	interviewId: z.string(),
	templateKey: z.string(),
	templateName: z.string(),
	analysisData: z.any(),
	confidenceScore: z.number().nullable(),
	status: z.enum(["pending", "processing", "completed", "failed"]),
	errorMessage: z.string().nullable(),
	processedAt: z.string().nullable(),
	createdAt: z.string(),
	interviewUrl: z.string().nullable(),
})

export const fetchConversationLensesTool = createTool({
	id: "fetch-conversation-lenses",
	description:
		"Search and retrieve conversation lens templates and analyses. Lenses are analytical frameworks for extracting structured insights from interviews (e.g., Customer Discovery, Sales BANT, User Testing, Product Insights, Project Research). Use this to understand what lenses are available, check analysis status, or retrieve lens data for specific interviews.",
	inputSchema: z.object({
		mode: z
			.enum(["templates", "analyses", "both"])
			.nullish()
			.describe(
				"What to fetch: 'templates' (available lens frameworks), 'analyses' (applied lens results), or 'both'. Default: 'both'"
			),
		projectId: z.string().nullish().describe("Project ID to scope the search. Defaults to current project in context."),
		interviewId: z
			.string()
			.nullish()
			.describe("Filter analyses by specific interview ID. Only applies when mode includes 'analyses'."),
		templateKey: z
			.string()
			.nullish()
			.describe(
				"Filter by specific lens template (e.g., 'customer-discovery', 'sales-bant', 'project-research'). Applies to both templates and analyses."
			),
		category: z
			.string()
			.nullish()
			.describe(
				"Filter templates by category (e.g., 'research', 'product', 'sales'). Only applies when mode includes 'templates'."
			),
		status: z
			.enum(["pending", "processing", "completed", "failed"])
			.nullish()
			.describe("Filter analyses by processing status. Only applies when mode includes 'analyses'."),
		limit: z.number().int().min(1).max(100).nullish().describe("Maximum number of analyses to return. Default: 50"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		templates: z.array(lensTemplateSchema).optional(),
		analyses: z.array(lensAnalysisSchema).optional(),
		totalTemplates: z.number().optional(),
		totalAnalyses: z.number().optional(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context?.requestContext?.get?.("project_id")
		const runtimeAccountId = context?.requestContext?.get?.("account_id")

		const mode = input.mode ?? "both"
		const projectId = input.projectId ?? runtimeProjectId ?? null
		const interviewId = input.interviewId ?? null
		const templateKey = input.templateKey ?? null
		const category = input.category ?? null
		const status = input.status ?? null
		const limit = input.limit ?? 50

		consola.debug("fetch-conversation-lenses: execute start", {
			mode,
			projectId,
			interviewId,
			templateKey,
			category,
			status,
			limit,
		})

		try {
			const result: {
				success: boolean
				message: string
				templates?: any[]
				analyses?: any[]
				totalTemplates?: number
				totalAnalyses?: number
			} = {
				success: true,
				message: "",
			}

			// Fetch templates if requested
			if (mode === "templates" || mode === "both") {
				let templatesQuery = supabase
					.from("conversation_lens_templates")
					.select("*")
					.eq("is_active", true)
					.order("display_order", { ascending: true })

				if (templateKey) {
					templatesQuery = templatesQuery.eq("template_key", templateKey)
				}

				if (category) {
					templatesQuery = templatesQuery.eq("category", category)
				}

				const { data: templatesData, error: templatesError } = await templatesQuery

				if (templatesError) {
					consola.error("fetch-conversation-lenses: error fetching templates", templatesError)
					throw templatesError
				}

				result.templates = (templatesData || []).map((t) => {
					const definition = t.template_definition as any
					return {
						templateKey: t.template_key,
						templateName: t.template_name,
						summary: t.summary,
						category: t.category,
						displayOrder: t.display_order ?? 100,
						primaryObjective: t.primary_objective,
						sections: definition?.sections || [],
						requiresProjectContext: definition?.requires_project_context ?? false,
						recommendationsEnabled: definition?.recommendations_enabled ?? false,
					}
				})

				result.totalTemplates = result.templates.length
			}

			// Fetch analyses if requested
			if (mode === "analyses" || mode === "both") {
				if (!projectId && !interviewId) {
					consola.warn("fetch-conversation-lenses: missing projectId or interviewId for analyses")
					return {
						success: false,
						message:
							"Project ID or Interview ID is required when fetching analyses. Provide projectId or interviewId parameter.",
						templates: result.templates,
						totalTemplates: result.totalTemplates,
					}
				}

				let analysesQuery = supabase
					.from("conversation_lens_analyses")
					.select("*")
					.order("created_at", { ascending: false })
					.limit(limit)

				if (projectId) {
					analysesQuery = analysesQuery.eq("project_id", projectId)
				}

				if (interviewId) {
					analysesQuery = analysesQuery.eq("interview_id", interviewId)
				}

				if (templateKey) {
					analysesQuery = analysesQuery.eq("template_key", templateKey)
				}

				if (status) {
					analysesQuery = analysesQuery.eq("status", status)
				}

				const { data: analysesData, error: analysesError } = await analysesQuery

				if (analysesError) {
					consola.error("fetch-conversation-lenses: error fetching analyses", analysesError)
					throw analysesError
				}

				// Fetch template names for analyses
				const uniqueTemplateKeys = [...new Set((analysesData || []).map((a) => a.template_key))]
				const { data: templatesForAnalyses } = await supabase
					.from("conversation_lens_templates")
					.select("template_key, template_name")
					.in("template_key", uniqueTemplateKeys)

				const templateNameMap = new Map((templatesForAnalyses || []).map((t) => [t.template_key, t.template_name]))

				// Generate route definitions for URL generation
				const projectPath = runtimeAccountId && projectId ? `/a/${runtimeAccountId}/${projectId}` : ""
				const routes = projectPath ? createRouteDefinitions(projectPath) : null

				result.analyses = (analysesData || []).map((a) => ({
					id: a.id,
					interviewId: a.interview_id,
					templateKey: a.template_key,
					templateName: templateNameMap.get(a.template_key) || a.template_key,
					analysisData: a.analysis_data,
					confidenceScore: a.confidence_score,
					status: a.status as "pending" | "processing" | "completed" | "failed",
					errorMessage: a.error_message,
					processedAt: a.processed_at,
					createdAt: a.created_at,
					interviewUrl: routes ? `${HOST}${routes.interviews.detail(a.interview_id)}` : null,
				}))

				result.totalAnalyses = result.analyses.length
			}

			// Build success message
			const messageParts: string[] = []
			if (result.templates) {
				messageParts.push(`${result.totalTemplates} lens template(s)`)
			}
			if (result.analyses) {
				messageParts.push(`${result.totalAnalyses} lens analysis/analyses`)
			}
			result.message = `Retrieved ${messageParts.join(" and ")}.`

			return result
		} catch (error) {
			consola.error("fetch-conversation-lenses: unexpected error", error)
			const errorMessage = error instanceof Error ? error.message : "Unexpected error fetching conversation lenses."
			return {
				success: false,
				message: errorMessage,
			}
		}
	},
})
