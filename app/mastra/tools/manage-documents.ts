import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { upsertProjectSection } from "~/features/projects/db"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

/**
 * Comprehensive document management tool for Mastra agents
 * Allows creating, editing, reading, and listing project documents of any type
 * Examples: positioning_statement, seo_strategy, meeting_notes, research_notes, etc.
 */

export const manageDocumentsTool = createTool({
	id: "manage-documents",
	description: `Manage project documents of any type. Can create, update, read, or list documents.

IMPORTANT - Natural Language Understanding:
When users say things like "save our positioning" or "document the SEO strategy",
translate to appropriate document kinds using snake_case:

Common User Phrases → Document Kinds:
- "positioning", "our position" → positioning_statement
- "SEO strategy", "keywords", "SEO plan" → seo_strategy
- "meeting notes", "notes from meeting" → meeting_notes
- "research notes", "observations" → research_notes
- "competitive analysis", "competitor research" → competitive_analysis
- "market analysis", "market research" → market_analysis
- "pricing strategy", "pricing model" → pricing_strategy
- "go to market", "GTM plan", "launch plan" → go_to_market
- "brand guidelines", "brand guide" → brand_guidelines
- "messaging", "key messages" → messaging_framework
- "product roadmap", "roadmap" → product_roadmap
- "business plan" → business_plan
- "sales playbook" → sales_playbook
- "content strategy", "content plan" → content_strategy
- "feature specs", "feature requirements" → feature_specs
- "user stories" → user_stories
- "technical specs", "tech specs" → technical_specs
- "design docs", "design documentation" → design_docs

For unique documents, create descriptive snake_case names:
- "Q1 2025 goals" → q1_2025_goals
- "customer interview with Acme" → customer_interview_acme
- "pricing discussion" → pricing_discussion

Document types are completely flexible - any snake_case name works!

Data storage:
- Put human-readable Markdown in content.
- Put structured tables/JSON in metadata.structured (automatically done when content is an object).
- Do NOT create project_assets here; those are reserved for uploaded files.

Operations:
- create: Create a new document (fails if kind already exists)
- update: Update existing document content
- upsert: Create or update (recommended for most cases)
- read: Get document content by kind
- list: List all documents for the project`,
	inputSchema: z.object({
		projectId: z.string().optional().describe("Project ID. Defaults to current project in context."),
		operation: z
			.enum(["create", "update", "upsert", "read", "list"])
			.describe("Operation to perform: create, update, upsert, read, or list"),
		kind: z
			.string()
			.optional()
			.describe(
				"Document type identifier (e.g., 'positioning_statement', 'seo_strategy'). Required for create/update/upsert/read."
			),
		content: z
			.any()
			.optional()
			.describe(
				"Markdown content of the document (string or object that will be JSON stringified). Required for create/update/upsert."
			),
		metadata: z
			.any()
			.optional()
			.nullable()
			.describe(
				"Optional metadata to store with the document (JSON object). If content is an object, it will be stored in metadata.structured."
			),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		document: z
			.object({
				id: z.string(),
				kind: z.string(),
				content: z.string(),
				metadata: z.record(z.any()).nullable(),
				created_at: z.string(),
				updated_at: z.string(),
			})
			.nullable()
			.optional(),
		documents: z
			.array(
				z.object({
					id: z.string(),
					kind: z.string(),
					content: z.string(),
					metadata: z.record(z.any()).nullable(),
					created_at: z.string(),
					updated_at: z.string(),
				})
			)
			.optional(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context?.requestContext?.get?.("project_id")

		// Extract tool parameters from input
		const projectId = input.projectId ?? runtimeProjectId ?? null
		const operation = input.operation
		const kind = input.kind
		const rawContent = input.content
		// If content is an object, store it under meta.structured; if string, store in content_md
		const isObjectContent = typeof rawContent === "object" && rawContent !== null
		const content = isObjectContent ? null : rawContent
		const metadata = isObjectContent ? { structured: rawContent, ...(input.metadata ?? {}) } : input.metadata

		consola.debug("manage-documents: execute start", {
			projectId,
			operation,
			kind,
			hasContent: !!content,
		})

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				document: null,
			}
		}

		const projectIdStr = projectId as string

		try {
			// LIST operation - get all documents for project
			if (operation === "list") {
				const { data, error } = await supabase
					.from("project_sections")
					.select("id, kind, content_md, meta, created_at, updated_at")
					.eq("project_id", projectIdStr)
					.order("kind")

				if (error) throw error

				return {
					success: true,
					message: `Found ${data?.length ?? 0} documents`,
					documents: (data ?? []).map((doc) => ({
						id: doc.id,
						kind: doc.kind,
						content: doc.content_md,
						metadata: (doc.meta as Record<string, unknown>) ?? null,
						created_at: doc.created_at,
						updated_at: doc.updated_at,
					})),
				}
			}

			// All other operations require kind
			if (!kind) {
				return {
					success: false,
					message: `The '${operation}' operation requires a 'kind' parameter`,
					document: null,
				}
			}

			// READ operation - get specific document
			if (operation === "read") {
				const { data, error } = await supabase
					.from("project_sections")
					.select("id, kind, content_md, meta, created_at, updated_at")
					.eq("project_id", projectIdStr)
					.eq("kind", kind)
					.maybeSingle()

				if (error) throw error

				if (!data) {
					return {
						success: false,
						message: `Document of type '${kind}' not found`,
						document: null,
					}
				}

				return {
					success: true,
					message: `Document '${kind}' retrieved`,
					document: {
						id: data.id,
						kind: data.kind,
						content: data.content_md,
						metadata: (data.meta as Record<string, unknown>) ?? null,
						created_at: data.created_at,
						updated_at: data.updated_at,
					},
				}
			}

			// CREATE/UPDATE/UPSERT operations require content (string or object)
			if (!content && !metadata) {
				return {
					success: false,
					message: `The '${operation}' operation requires 'content' parameter`,
					document: null,
				}
			}

			// CREATE operation - fail if exists
			if (operation === "create") {
				// Check if already exists
				const { data: existing } = await supabase
					.from("project_sections")
					.select("id")
					.eq("project_id", projectIdStr)
					.eq("kind", kind)
					.maybeSingle()

				if (existing) {
					return {
						success: false,
						message: `Document of type '${kind}' already exists. Use 'update' or 'upsert' instead.`,
						document: null,
					}
				}
			}

			// UPDATE operation - fail if doesn't exist
			if (operation === "update") {
				const { data: existing } = await supabase
					.from("project_sections")
					.select("id")
					.eq("project_id", projectIdStr)
					.eq("kind", kind)
					.maybeSingle()

				if (!existing) {
					return {
						success: false,
						message: `Document of type '${kind}' not found. Use 'create' or 'upsert' instead.`,
						document: null,
					}
				}
			}

			// Perform the create/update/upsert
			const meta = metadata ?? { [kind]: content }

			const result = await upsertProjectSection({
				supabase,
				data: {
					project_id: projectIdStr,
					kind,
					content_md: content,
					meta: meta as Database["public"]["Tables"]["project_sections"]["Insert"]["meta"],
				},
			})

			if (result?.error) {
				throw new Error(result.error.message || "Failed to save document")
			}

			// Fetch the saved document to return
			const { data: savedDoc, error: fetchError } = await supabase
				.from("project_sections")
				.select("id, kind, content_md, meta, created_at, updated_at")
				.eq("project_id", projectIdStr)
				.eq("kind", kind)
				.single()

			if (fetchError) throw fetchError

			return {
				success: true,
				message: `Document '${kind}' ${operation === "create" ? "created" : operation === "update" ? "updated" : "saved"}`,
				document: {
					id: savedDoc.id,
					kind: savedDoc.kind,
					content: savedDoc.content_md,
					metadata: (savedDoc.meta as Record<string, unknown>) ?? null,
					created_at: savedDoc.created_at,
					updated_at: savedDoc.updated_at,
				},
			}
		} catch (error) {
			consola.error("manage-documents: unexpected error", error)
			return {
				success: false,
				message: `Failed to ${operation} document: ${error instanceof Error ? error.message : String(error)}`,
				document: null,
			}
		}
	},
})
