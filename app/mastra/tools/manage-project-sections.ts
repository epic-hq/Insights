import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const baseOutput = z.object({
	success: z.boolean(),
	message: z.string(),
	warnings: z.array(z.string()).optional(),
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

const sectionOutputSchema = z.object({
	id: z.string(),
	kind: z.string(),
	contentMd: z.string(),
	meta: z.record(z.string(), z.any()).nullable(),
	projectId: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
})

export const fetchProjectSectionTool = createTool({
	id: "fetch-project-section",
	description: "Fetch a specific project section by kind (e.g., target_orgs, target_roles, research_goal)",
	inputSchema: z.object({
		kind: z.string().describe("Section kind to fetch (e.g., target_orgs, target_roles)"),
	}),
	outputSchema: baseOutput.extend({
		section: sectionOutputSchema.nullable().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { projectId } = ensureContext(context)

			const { data, error } = await supabase
				.from("project_sections")
				.select("*")
				.eq("project_id", projectId)
				.eq("kind", input.kind)
				.order("updated_at", { ascending: false })
				.limit(1)
				.maybeSingle()

			if (error) {
				consola.error("fetchProjectSectionTool error", error)
				return { success: false, message: error.message }
			}

			if (!data) {
				return {
					success: true,
					message: `No section found for kind: ${input.kind}`,
					section: null,
				}
			}

			return {
				success: true,
				message: "Section fetched",
				section: {
					id: data.id,
					kind: data.kind,
					contentMd: data.content_md,
					meta: data.meta as Record<string, any> | null,
					projectId: data.project_id,
					createdAt: data.created_at,
					updatedAt: data.updated_at,
				},
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("fetchProjectSectionTool unexpected error", message)
			return { success: false, message }
		}
	},
})

export const updateProjectSectionMetaTool = createTool({
	id: "update-project-section-meta",
	description:
		"Update JSON meta fields for a project section. Supports merging for target_orgs, target_roles, and other array/object fields. Use mergeMeta=true to append to arrays instead of replacing.",
	inputSchema: z.object({
		kind: z.string().describe("Section kind (e.g., target_orgs, target_roles)"),
		meta: z.record(z.string(), z.any()).describe("JSON meta object to update"),
		mergeMeta: z
			.boolean()
			.optional()
			.default(false)
			.describe("If true, merge with existing meta (append to arrays, merge objects)"),
		contentMd: z.string().optional().describe("Optional markdown content to update"),
	}),
	outputSchema: baseOutput.extend({
		section: sectionOutputSchema.nullable().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { projectId, userId } = ensureContext(context)

			// Fetch existing section if merging
			let finalMeta = input.meta
			if (input.mergeMeta) {
				const { data: existing } = await supabase
					.from("project_sections")
					.select("meta")
					.eq("project_id", projectId)
					.eq("kind", input.kind)
					.order("updated_at", { ascending: false })
					.limit(1)
					.maybeSingle()

				if (existing?.meta) {
					const existingMeta = existing.meta as Record<string, any>
					finalMeta = { ...existingMeta }

					// Merge logic: arrays are concatenated and deduplicated, objects are merged
					for (const [key, value] of Object.entries(input.meta)) {
						if (Array.isArray(value) && Array.isArray(existingMeta[key])) {
							// Merge arrays and remove duplicates
							finalMeta[key] = [...new Set([...existingMeta[key], ...value])]
						} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
							// Merge objects
							finalMeta[key] = { ...(existingMeta[key] || {}), ...value }
						} else {
							// Replace scalar values
							finalMeta[key] = value
						}
					}

					consola.debug("Merged meta", {
						kind: input.kind,
						existing: existingMeta,
						new: input.meta,
						merged: finalMeta,
					})
				}
			}

			// Prepare update payload
			const updates: Database["public"]["Tables"]["project_sections"]["Update"] = {
				meta: finalMeta,
				updated_by: userId,
			}

			if (input.contentMd) {
				updates.content_md = input.contentMd
			}

			// Upsert section
			const { data, error } = await supabase
				.from("project_sections")
				.upsert(
					{
						project_id: projectId,
						kind: input.kind,
						content_md: input.contentMd || "",
						meta: finalMeta,
						created_by: userId,
						updated_by: userId,
					},
					{
						onConflict: "project_id,kind",
					}
				)
				.select("*")
				.single()

			if (error || !data) {
				consola.error("updateProjectSectionMetaTool error", error)
				return {
					success: false,
					message: error?.message || "Failed to update section",
				}
			}

			return {
				success: true,
				message: `Section ${input.kind} updated`,
				section: {
					id: data.id,
					kind: data.kind,
					contentMd: data.content_md,
					meta: data.meta as Record<string, any> | null,
					projectId: data.project_id,
					createdAt: data.created_at,
					updatedAt: data.updated_at,
				},
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("updateProjectSectionMetaTool unexpected error", message)
			return { success: false, message }
		}
	},
})

export const deleteProjectSectionMetaKeyTool = createTool({
	id: "delete-project-section-meta-key",
	description: "Delete specific keys from a section's meta JSON object, or remove items from meta arrays",
	inputSchema: z.object({
		kind: z.string().describe("Section kind (e.g., target_orgs, target_roles)"),
		keys: z.array(z.string()).optional().describe("Meta keys to delete entirely"),
		removeFromArrays: z
			.record(z.string(), z.array(z.any()))
			.optional()
			.describe("Remove specific items from array fields. Format: { fieldName: [items to remove] }"),
	}),
	outputSchema: baseOutput.extend({
		section: sectionOutputSchema.nullable().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const supabase = supabaseAdmin as SupabaseClient<Database>
			const { projectId, userId } = ensureContext(context)

			// Fetch existing section
			const { data: existing, error: fetchError } = await supabase
				.from("project_sections")
				.select("*")
				.eq("project_id", projectId)
				.eq("kind", input.kind)
				.order("updated_at", { ascending: false })
				.limit(1)
				.maybeSingle()

			if (fetchError) {
				return { success: false, message: fetchError.message }
			}

			if (!existing) {
				return {
					success: false,
					message: `No section found for kind: ${input.kind}`,
				}
			}

			const meta = (existing.meta as Record<string, any>) || {}

			// Delete specific keys
			if (input.keys && input.keys.length > 0) {
				for (const key of input.keys) {
					delete meta[key]
				}
			}

			// Remove items from arrays
			if (input.removeFromArrays) {
				for (const [field, itemsToRemove] of Object.entries(input.removeFromArrays)) {
					if (Array.isArray(meta[field])) {
						meta[field] = meta[field].filter((item: any) => !itemsToRemove.includes(item))
					}
				}
			}

			// Update section
			const { data, error } = await supabase
				.from("project_sections")
				.update({
					meta,
					updated_by: userId,
				})
				.eq("id", existing.id)
				.select("*")
				.single()

			if (error || !data) {
				consola.error("deleteProjectSectionMetaKeyTool error", error)
				return {
					success: false,
					message: error?.message || "Failed to delete meta keys",
				}
			}

			return {
				success: true,
				message: `Deleted keys from section ${input.kind}`,
				section: {
					id: data.id,
					kind: data.kind,
					contentMd: data.content_md,
					meta: data.meta as Record<string, any> | null,
					projectId: data.project_id,
					createdAt: data.created_at,
					updatedAt: data.updated_at,
				},
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error"
			consola.error("deleteProjectSectionMetaKeyTool unexpected error", message)
			return { success: false, message }
		}
	},
})
