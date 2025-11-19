import type { SupabaseClient } from "@supabase/supabase-js"
import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { upsertProjectSection } from "~/features/projects/db"
import { PROJECT_SECTIONS, getSectionConfig } from "~/features/projects/section-config"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

// Section formatters - matches api.save-project-goals.tsx
const formatters = {
	array_numbered: (items: string[], field: string) => ({
		content_md: items.map((v, i) => `${i + 1}. ${v}`).join("\n"),
		meta: { [field]: items },
	}),
	array_spaced: (items: string[], field: string) => ({
		content_md: items.map((v, i) => `${i + 1}. ${v}`).join("\n\n"),
		meta: { [field]: items },
	}),
	plain_text: (text: string, field: string) => ({
		content_md: text,
		meta: { [field]: text },
	}),
	goal_with_details: (goal: string, details: string) => ({
		content_md: goal,
		meta: { research_goal: goal, research_goal_details: details || "" },
	}),
}

/**
 * Generic section processor using centralized config
 * Matches logic from api.save-project-goals.tsx processSection()
 */
function processSection(
	kind: string,
	data: unknown
): null | {
	kind: string
	content_md: string
	meta: Record<string, unknown>
} {
	const config = getSectionConfig(kind)
	if (!config) {
		consola.warn(`Unknown section kind: ${kind}`)
		return null
	}

	// Handle array types
	if (config.type === "string[]") {
		if (!Array.isArray(data)) return null
		const formatter = config.arrayFormatter === "spaced" ? formatters.array_spaced : formatters.array_numbered
		return { kind, ...formatter(data, kind) }
	}

	// Handle string types
	if (config.type === "string") {
		if (typeof data !== "string") return null
		if (data.trim() || config.allowEmpty) {
			return { kind, ...formatters.plain_text(data, kind) }
		}
		return null
	}

	// Handle research_goal object (special case with details)
	if (config.type === "object" && kind === "research_goal") {
		if (typeof data === "object" && data && "research_goal" in data) {
			const goalData = data as { research_goal: string; research_goal_details?: string }
			if (goalData.research_goal?.trim()) {
				return {
					kind,
					...formatters.goal_with_details(goalData.research_goal, goalData.research_goal_details || ""),
				}
			}
		}
		// Allow string for backwards compatibility
		if (typeof data === "string" && data.trim()) {
			return { kind, ...formatters.goal_with_details(data, "") }
		}
		return null
	}

	return null
}

// Dynamically build schema from PROJECT_SECTIONS config
const buildInputSchema = () => {
	const schemaFields: Record<string, z.ZodTypeAny> = {
		project_id: z.string().min(1, "project_id is required"),
	}

	for (const section of PROJECT_SECTIONS) {
		if (section.kind === "research_goal") {
			// Special case: research_goal can be string or object with details
			schemaFields.research_goal = z.string().optional()
			schemaFields.research_goal_details = z.string().optional()
		} else if (section.type === "string[]") {
			schemaFields[section.kind] = z.array(z.string()).optional()
		} else if (section.type === "string") {
			schemaFields[section.kind] = z.string().optional()
		}
	}

	return z.object(schemaFields)
}

export const saveProjectSectionsDataTool = createTool({
	id: "save-project-sections-data",
	description: "Save project sections to database. Accepts any combination of project section fields.",
	inputSchema: buildInputSchema(),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		saved: z.array(z.string()).optional(),
		errors: z.array(z.string()).optional(),
	}),
	execute: async ({ context: toolContext, runtimeContext }) => {
		try {
			const { project_id, ...sectionData } = toolContext
			const runtimeProjectId = runtimeContext?.get?.("project_id")

			// Use runtime project_id if tool context has 'current' or missing
			const actualProjectId = (!project_id || project_id === 'current')
				? runtimeProjectId
				: project_id

			if (!actualProjectId) {
				return { success: false, message: "Missing project_id in both context and runtime" }
			}

			const toSave: Array<{ kind: string; content_md: string; meta: Record<string, unknown> }> = []

			// Process research_goal specially (combines research_goal + research_goal_details)
			if (sectionData.research_goal || sectionData.research_goal_details) {
				const processed = processSection("research_goal", {
					research_goal: sectionData.research_goal || "",
					research_goal_details: sectionData.research_goal_details || "",
				})
				if (processed) toSave.push(processed)
			}

			// Process all other sections dynamically
			for (const section of PROJECT_SECTIONS) {
				if (section.kind === "research_goal") continue // Already handled

				const data = sectionData[section.kind]
				if (data !== undefined && data !== null) {
					const processed = processSection(section.kind, data)
					if (processed) toSave.push(processed)
				}
			}

			if (toSave.length === 0) {
				return { success: false, message: "No valid sections to save" }
			}

			const savedKinds: string[] = []
			const errors: string[] = []

			for (const section of toSave) {
				const res = await upsertProjectSection({
					supabase: supabaseAdmin as unknown as SupabaseClient<Database>,
					data: {
						project_id: actualProjectId,
						kind: section.kind,
						content_md: section.content_md,
						meta: section.meta as Database["public"]["Tables"]["project_sections"]["Insert"]["meta"],
					},
				})

				if (res?.error) {
					const errorMsg = `${section.kind}: ${res.error?.message || "unknown error"}`
					consola.error("Failed to save section", errorMsg)
					errors.push(errorMsg)
				} else {
					savedKinds.push(section.kind)
				}
			}

			if (errors.length > 0) {
				return {
					success: false,
					message: `Saved ${savedKinds.length}/${toSave.length} sections`,
					saved: savedKinds,
					errors,
				}
			}

			return {
				success: true,
				message: `Saved ${savedKinds.length} sections`,
				saved: savedKinds,
			}
		} catch (e) {
			consola.error("save-project-sections-data error", e)
			return { success: false, message: `Error: ${e instanceof Error ? e.message : String(e)}` }
		}
	},
})
