import { randomUUID } from "node:crypto"
import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

const statusEnum = z.enum(["proposed", "asked", "answered", "skipped", "rejected", "deleted", "selected", "backup"])

const promptOutputSchema = z.object({
	id: z.string(),
	text: z.string(),
	status: z.string().nullable(),
	category: z.string().nullable(),
	rationale: z.string().nullable(),
	isMustHave: z.boolean().nullable(),
	isSelected: z.boolean().nullable(),
	orderIndex: z.number().nullable(),
	selectedOrder: z.number().nullable(),
	estimatedTimeMinutes: z.number().nullable(),
	source: z.string().nullable(),
	scores: z.unknown().nullable(),
	projectId: z.string(),
	planId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	detailRoute: z.string().nullable(),
})

function ensureContext(context?: Map<string, unknown> | any) {
	const accountId = context?.requestContext?.get?.("account_id") as string | undefined
	const projectId = context?.requestContext?.get?.("project_id") as string | undefined
	const userId = context?.requestContext?.get?.("user_id") as string | undefined
	if (!accountId || !projectId) {
		throw new Error("Missing accountId or projectId in runtime context")
	}
	if (!userId) {
		throw new Error("Missing userId in runtime context")
	}
	return { accountId, projectId, userId }
}

function buildProjectPath(accountId: string, projectId: string) {
	return `/a/${accountId}/${projectId}`
}

function mapPrompt(row: Database["public"]["Tables"]["interview_prompts"]["Row"], projectPath: string) {
	const routes = createRouteDefinitions(projectPath)
	return {
		id: row.id,
		text: row.text,
		status: row.status ?? null,
		category: row.category ?? null,
		rationale: row.rationale ?? null,
		isMustHave: row.is_must_have ?? null,
		isSelected: row.is_selected ?? null,
		orderIndex: row.order_index ?? null,
		selectedOrder: row.selected_order ?? null,
		estimatedTimeMinutes: row.estimated_time_minutes ?? null,
		source: row.source ?? null,
		scores: row.scores ?? null,
		projectId: row.project_id,
		planId: row.plan_id ?? null,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		detailRoute: `${HOST}${routes.questions.detail(row.id)}`,
	}
}

const baseOutput = z.object({
	success: z.boolean(),
	message: z.string(),
	warnings: z.array(z.string()).optional(),
})

export const fetchInterviewPromptsTool = createTool({
	id: "fetch-interview-prompts",
	description:
		"List interview prompts for the current project. Use to inspect, sort, or filter questions before editing or selecting.",
	inputSchema: z.object({
		search: z.string().optional().describe("Case-insensitive search in prompt text or rationale"),
		status: z.array(statusEnum).optional().describe("Filter by prompt status"),
		category: z.string().optional().describe("Filter by category"),
		isMustHave: z.boolean().optional().describe("Filter must-have prompts"),
		isSelected: z.boolean().optional().describe("Filter selected prompts"),
		ids: z.array(z.string()).optional().describe("Specific prompt IDs to fetch"),
		limit: z.number().int().min(1).max(200).optional().describe("Maximum number of prompts to return"),
	}),
	outputSchema: baseOutput.extend({
		total: z.number().optional(),
		prompts: z.array(promptOutputSchema).optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)
			const filters = input ?? {}

			const query = supabase
				.from("interview_prompts")
				.select("*", { count: "exact" })
				.eq("project_id", projectId)
				.order("order_index", { ascending: true, nullsFirst: true })
				.order("selected_order", { ascending: true, nullsLast: true })
				.order("created_at", { ascending: false })

			if (filters.ids && filters.ids.length > 0) {
				query.in("id", filters.ids)
			}
			if (filters.status && filters.status.length > 0) {
				query.in("status", filters.status)
			}
			if (typeof filters.isMustHave === "boolean") {
				query.eq("is_must_have", filters.isMustHave)
			}
			if (typeof filters.isSelected === "boolean") {
				query.eq("is_selected", filters.isSelected)
			}
			if (filters.category) {
				query.eq("category", filters.category)
			}
			if (filters.search) {
				const term = `%${filters.search.trim()}%`
				query.or(`text.ilike.${term},rationale.ilike.${term}`)
			}
			if (filters.limit) {
				query.limit(filters.limit)
			}

			const { data, error, count } = await query

			if (error) {
				consola.error("fetchInterviewPromptsTool error", {
					message: error.message,
					code: error.code,
					details: error.details,
				})
				return { success: false, message: error.message }
			}

			return {
				success: true,
				message: "Fetched interview prompts",
				total: count ?? data?.length ?? 0,
				prompts: (data || []).map((row) => mapPrompt(row, projectPath)),
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("fetchInterviewPromptsTool unexpected error", message)
			return { success: false, message }
		}
	},
})

export const createInterviewPromptTool = createTool({
	id: "create-interview-prompt",
	description: "Create a new interview prompt for the current project.",
	inputSchema: z.object({
		text: z.string().min(3).describe("Prompt text to ask in interviews"),
		category: z.string().optional(),
		rationale: z.string().optional(),
		status: statusEnum.optional().default("proposed"),
		isMustHave: z.boolean().optional(),
		isSelected: z.boolean().optional(),
		orderIndex: z.number().int().optional(),
		selectedOrder: z.number().int().optional(),
		estimatedTimeMinutes: z.number().int().optional(),
		source: z.string().optional(),
		planId: z.string().optional(),
		scores: z.record(z.string(), z.any()).optional(),
	}),
	outputSchema: baseOutput.extend({ prompt: promptOutputSchema.optional() }),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)

			consola.debug("createInterviewPromptTool invoked", {
				projectId,
				accountId,
				hasText: typeof input?.text === "string" && input.text.length > 0,
				inputPreview: input?.text?.slice(0, 120),
			})

			if (!input || typeof input.text !== "string") {
				return { success: false, message: "Prompt text is required" }
			}

			const payload: Database["public"]["Tables"]["interview_prompts"]["Insert"] = {
				id: randomUUID(),
				project_id: projectId,
				text: input.text,
				category: input.category ?? null,
				rationale: input.rationale ?? null,
				status: input.status ?? "proposed",
				is_must_have: input.isMustHave ?? null,
				is_selected: input.isSelected ?? null,
				order_index: input.orderIndex ?? null,
				selected_order: input.selectedOrder ?? null,
				estimated_time_minutes: input.estimatedTimeMinutes ?? null,
				source: input.source ?? "agent",
				plan_id: input.planId ?? null,
				scores: input.scores ?? null,
				created_by: userId,
				updated_by: userId,
			}

			const { data, error } = await supabase.from("interview_prompts").insert(payload).select("*").single()

			if (error || !data) {
				consola.error("createInterviewPromptTool error", {
					message: error?.message,
					code: error?.code,
					details: error?.details,
					hint: error?.hint,
					projectId,
					payloadShape: {
						text: payload.text,
						category: payload.category,
						status: payload.status,
						project_id: payload.project_id,
					},
				})
				return {
					success: false,
					message: error?.message || "Failed to create prompt",
					warnings: [error?.details, error?.hint].filter(Boolean) as string[],
				}
			}

			return {
				success: true,
				message: "Prompt created",
				prompt: mapPrompt(data, projectPath),
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("createInterviewPromptTool unexpected error", message)
			return { success: false, message, warnings: [message] }
		}
	},
})

export const updateInterviewPromptTool = createTool({
	id: "update-interview-prompt",
	description:
		"Update an existing interview prompt by ID. Supports partial JSON updates - if mergeScores is true, new scores will be merged with existing scores instead of replacing them.",
	inputSchema: z.object({
		id: z.string(),
		text: z.string().optional(),
		category: z.string().optional(),
		rationale: z.string().optional(),
		status: statusEnum.optional(),
		isMustHave: z.boolean().optional(),
		isSelected: z.boolean().optional(),
		orderIndex: z.number().int().optional(),
		selectedOrder: z.number().int().optional(),
		estimatedTimeMinutes: z.number().int().optional(),
		source: z.string().optional(),
		scores: z.record(z.string(), z.any()).optional(),
		mergeScores: z
			.boolean()
			.optional()
			.default(false)
			.describe("If true, merge new scores with existing scores instead of replacing"),
	}),
	outputSchema: baseOutput.extend({ prompt: promptOutputSchema.optional() }),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { accountId, projectId, userId } = ensureContext(context)
			const projectPath = buildProjectPath(accountId, projectId)

			consola.debug("updateInterviewPromptTool invoked", {
				projectId,
				accountId,
				id: input?.id,
				hasText: typeof input?.text === "string" && input.text.length > 0,
				inputPreview: input?.text?.slice(0, 120),
				mergeScores: input?.mergeScores,
			})

			if (!input || !input.id) {
				return { success: false, message: "Prompt id is required" }
			}

			// If merging scores, fetch existing prompt first
			let finalScores = input.scores
			if (input.mergeScores && input.scores) {
				const { data: existing } = await supabase
					.from("interview_prompts")
					.select("scores")
					.eq("id", input.id)
					.eq("project_id", projectId)
					.single()

				if (existing?.scores) {
					// Merge existing scores with new scores
					const existingScores = existing.scores as Record<string, any>
					finalScores = {
						...existingScores,
						...input.scores,
					}
					consola.debug("Merged scores", {
						existing: existingScores,
						new: input.scores,
						merged: finalScores,
					})
				}
			}

			const updates: Database["public"]["Tables"]["interview_prompts"]["Update"] = {
				text: input.text,
				category: input.category,
				rationale: input.rationale,
				status: input.status,
				is_must_have: input.isMustHave,
				is_selected: input.isSelected,
				order_index: input.orderIndex,
				selected_order: input.selectedOrder,
				estimated_time_minutes: input.estimatedTimeMinutes,
				source: input.source,
				scores: finalScores,
				updated_by: userId,
			}

			const { data, error } = await supabase
				.from("interview_prompts")
				.update(updates)
				.eq("id", input.id)
				.eq("project_id", projectId)
				.select("*")
				.single()

			if (error || !data) {
				consola.error("updateInterviewPromptTool error", {
					message: error?.message,
					code: error?.code,
					details: error?.details,
					hint: error?.hint,
					projectId,
					updatesShape: {
						id: input.id,
						text: updates.text,
						category: updates.category,
						status: updates.status,
					},
				})
				return {
					success: false,
					message: error?.message || "Failed to update prompt",
					warnings: [error?.details, error?.hint].filter(Boolean) as string[],
				}
			}

			return {
				success: true,
				message: "Prompt updated",
				prompt: mapPrompt(data, projectPath),
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("updateInterviewPromptTool unexpected error", message)
			return { success: false, message, warnings: [message] }
		}
	},
})

export const deleteInterviewPromptTool = createTool({
	id: "delete-interview-prompt",
	description: "Soft-delete an interview prompt (sets status to deleted and clears selection).",
	inputSchema: z.object({
		id: z.string(),
	}),
	outputSchema: baseOutput,
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const { projectId, userId } = ensureContext(context)

		const { error, data } = await supabase
			.from("interview_prompts")
			.update({
				status: "deleted",
				is_selected: false,
				updated_by: userId,
			})
			.eq("id", input.id)
			.eq("project_id", projectId)
			.select("id")
			.single()

		if (error || !data) {
			consola.error("deleteInterviewPromptTool error", error?.message)
			return { success: false, message: error?.message || "Failed to delete prompt" }
		}

		return { success: true, message: "Prompt deleted" }
	},
})
