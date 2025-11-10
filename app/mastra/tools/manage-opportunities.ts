import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

type RawOpportunity = Database["public"]["Tables"]["opportunities"]["Row"] & {
	title?: string | null
	description?: string | null
	kanban_status?: string | null
	stage?: string | null
	amount?: number | null
	close_date?: string | null
	owner_id?: string | null
	status?: string | null
	metadata?: Record<string, unknown> | null
	related_insight_ids?: string[] | null
}

const opportunityOutputSchema = z.object({
	id: z.string(),
	title: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	kanbanStatus: z.string().nullable().optional(),
	stage: z.string().nullable().optional(),
	status: z.string().nullable().optional(),
	amount: z.number().nullable().optional(),
	closeDate: z.string().nullable().optional(),
	ownerId: z.string().nullable().optional(),
	relatedInsightIds: z.array(z.string()).nullable().optional(),
	metadata: z.record(z.unknown()).nullable().optional(),
	createdAt: z.string().nullable().optional(),
	updatedAt: z.string().nullable().optional(),
	detailRoute: z.string().nullable().optional(),
	editRoute: z.string().nullable().optional(),
})

function ensureContext(runtimeContext?: Map<string, unknown>) {
	const accountId = runtimeContext?.get?.("account_id") as string | undefined
	const projectId = runtimeContext?.get?.("project_id") as string | undefined
	if (!accountId || !projectId) {
		throw new Error("Missing accountId or projectId in runtime context")
	}
	return { accountId, projectId }
}

function buildProjectPath(accountId: string, projectId: string) {
	return `/a/${accountId}/${projectId}`
}

function mapOpportunity(row: RawOpportunity, projectPath: string) {
	const routes = createRouteDefinitions(projectPath)
	return {
		id: row.id,
		title: row.title ?? null,
		description: row.description ?? null,
		kanbanStatus: row.kanban_status ?? null,
		stage: row.stage ?? null,
		status: (row as Record<string, unknown>).status?.toString?.() ?? null,
		amount: typeof row.amount === "number" ? row.amount : row.amount ? Number(row.amount) : null,
		closeDate: row.close_date ?? null,
		ownerId: row.owner_id ?? null,
		relatedInsightIds: row.related_insight_ids ?? null,
		metadata: (row.metadata as Record<string, unknown> | null) ?? null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null,
		detailRoute: `${HOST}${routes.opportunities.detail(row.id)}`,
		editRoute: `${HOST}${routes.opportunities.edit(row.id)}`,
	}
}

export const fetchOpportunitiesTool = createTool({
	id: "fetch-opportunities",
	description:
		"List opportunities in the current project. Use this to inspect pipeline status, find deals by name, stage, or status, and cite details (amount, close date, description).",
	inputSchema: z.object({
		search: z.string().optional().describe("Case-insensitive substring to match against title or description"),
		kanbanStatus: z.string().optional().describe("Filter by kanban status (Explore, Validate, Build)"),
		stage: z.string().optional().describe("Filter by sales stage"),
		limit: z.number().int().min(1).max(100).optional().describe("Maximum number of opportunities to return"),
		opportunityIds: z.array(z.string()).optional().describe("Specific opportunity IDs to retrieve"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		total: z.number().optional(),
		opportunities: z.array(opportunityOutputSchema).optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const sanitizedSearch = context?.search?.trim()
			const limit = context?.limit ?? 25
			const opportunityIds = context?.opportunityIds ?? []

			let query = supabase
				.from("opportunities")
				.select("*")
				.eq("account_id", accountId)
				.eq("project_id", projectId)
				.order("created_at", { ascending: false })
				.limit(limit)

			if (context?.kanbanStatus) {
				query = query.eq("kanban_status", context.kanbanStatus)
			}

			if (context?.stage) {
				query = query.eq("stage", context.stage)
			}

			if (opportunityIds.length > 0) {
				query = query.in("id", opportunityIds)
			}

			if (sanitizedSearch) {
				const pattern = `%${sanitizedSearch.replace(/[%_]/g, "")}%`
				query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`)
			}

			const { data, error, count } = await query

			if (error) {
				consola.error("fetch-opportunities: supabase error", error)
				return { success: false, message: "Failed to fetch opportunities" }
			}

			const mapped = (data ?? []).map((row) => mapOpportunity(row as RawOpportunity, projectPath))

			return {
				success: true,
				message: mapped.length ? `Found ${mapped.length} opportunities` : "No opportunities found",
				total: typeof count === "number" ? count : mapped.length,
				opportunities: mapped,
			}
		} catch (error) {
			consola.error("fetch-opportunities: unexpected error", error)
			return { success: false, message: "Unexpected error fetching opportunities" }
		}
	},
})

const sharedOpportunityFields = {
	description: z.string().optional().describe("Deal summary or context"),
	kanbanStatus: z.string().optional().describe("Pipeline column (Explore, Validate, Build)"),
	stage: z.string().optional().describe("Sales stage (e.g., Discovery, Proposal)"),
	status: z.string().optional().describe("CRM status or health label"),
	amount: z.number().optional().describe("Deal amount in dollars"),
	closeDate: z.string().optional().describe("Expected close date (ISO 8601)"),
	ownerId: z.string().optional().describe("Team member responsible for the opportunity"),
	relatedInsightIds: z.array(z.string()).optional().describe("Insight IDs linked to this opportunity"),
	linkedInterviewId: z.string().optional().describe("Interview ID that inspired this opportunity"),
	metadata: z.record(z.unknown()).optional().describe("Additional structured metadata to store"),
}

export const createOpportunityTool = createTool({
	id: "create-opportunity",
	description:
		"Create a new sales opportunity for the current project. Use this when the user mentions a promising lead, deal, or follow-up action that should be tracked.",
	inputSchema: z.object({
		title: z.string().describe("Opportunity title"),
		...sharedOpportunityFields,
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		opportunity: opportunityOutputSchema.nullable(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const title = context?.title?.trim()
			if (!title) {
				return { success: false, message: "Title is required", opportunity: null }
			}

			const insertData: Record<string, unknown> = {
				title,
				account_id: accountId,
				project_id: projectId,
				kanban_status: context?.kanbanStatus || "Explore",
			}

			if (context?.description) insertData.description = context.description.trim()
			if (context?.stage) insertData.stage = context.stage.trim()
			if (context?.status) insertData.status = context.status.trim()
			if (typeof context?.amount === "number") insertData.amount = context.amount
			if (context?.closeDate) insertData.close_date = context.closeDate
			if (context?.ownerId) insertData.owner_id = context.ownerId
			if (context?.relatedInsightIds?.length) insertData.related_insight_ids = context.relatedInsightIds

			const metadata: Record<string, unknown> = { ...(context?.metadata ?? {}) }
			if (context?.linkedInterviewId) {
				metadata.linked_interview_id = context.linkedInterviewId
			}
			if (Object.keys(metadata).length > 0) {
				insertData.metadata = metadata
			}

			const { data, error } = await supabase
				.from("opportunities")
				.insert(insertData)
				.select("*")
				.single()

			if (error || !data) {
				consola.error("create-opportunity: insert failed", error)
				return { success: false, message: "Failed to create opportunity", opportunity: null }
			}

			return {
				success: true,
				message: `Created opportunity "${title}"`,
				opportunity: mapOpportunity(data as RawOpportunity, projectPath),
			}
		} catch (error) {
			consola.error("create-opportunity: unexpected error", error)
			return { success: false, message: "Unexpected error creating opportunity", opportunity: null }
		}
	},
})

export const updateOpportunityTool = createTool({
	id: "update-opportunity",
	description:
		"Update an existing opportunity's stage, status, description, amount, or linked interview. Use this after confirming which deal the user is referring to.",
	inputSchema: z.object({
		opportunityId: z.string().describe("ID of the opportunity to update"),
		title: z.string().optional().describe("Updated title"),
		...sharedOpportunityFields,
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		opportunity: opportunityOutputSchema.nullable(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(runtimeContext)
			const projectPath = buildProjectPath(accountId, projectId)
			const opportunityId = context?.opportunityId
			if (!opportunityId) {
				return { success: false, message: "opportunityId is required", opportunity: null }
			}

			const updateData: Record<string, unknown> = {}
			if (typeof context?.title === "string") updateData.title = context.title.trim()
			if (typeof context?.description === "string") updateData.description = context.description.trim()
			if (typeof context?.kanbanStatus === "string") updateData.kanban_status = context.kanbanStatus
			if (typeof context?.stage === "string") updateData.stage = context.stage
			if (typeof context?.status === "string") updateData.status = context.status
			if (typeof context?.amount === "number") updateData.amount = context.amount
			if (typeof context?.closeDate === "string") updateData.close_date = context.closeDate
			if (typeof context?.ownerId === "string") updateData.owner_id = context.ownerId
			if (Array.isArray(context?.relatedInsightIds)) updateData.related_insight_ids = context.relatedInsightIds

			if (context?.metadata || context?.linkedInterviewId !== undefined) {
				const metadata: Record<string, unknown> = { ...(context?.metadata ?? {}) }
				if (context?.linkedInterviewId) {
					metadata.linked_interview_id = context.linkedInterviewId
				}
				updateData.metadata = metadata
			}

			if (Object.keys(updateData).length === 0) {
				return { success: false, message: "No fields provided to update", opportunity: null }
			}

			const { data, error } = await supabase
				.from("opportunities")
				.update(updateData)
				.eq("id", opportunityId)
				.eq("account_id", accountId)
				.eq("project_id", projectId)
				.select("*")
				.single()

			if (error || !data) {
				consola.error("update-opportunity: update failed", error)
				return { success: false, message: "Failed to update opportunity", opportunity: null }
			}

			return {
				success: true,
				message: `Updated opportunity ${opportunityId}`,
				opportunity: mapOpportunity(data as RawOpportunity, projectPath),
			}
		} catch (error) {
			consola.error("update-opportunity: unexpected error", error)
			return { success: false, message: "Unexpected error updating opportunity", opportunity: null }
		}
	},
})
