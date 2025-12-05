import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { getPersonas } from "~/features/personas/db"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import { HOST } from "~/paths"
import { personasDetailSchema } from "~/schemas"
import type { Database } from "~/types"
import { createRouteDefinitions } from "~/utils/route-definitions"

export const fetchPersonasTool = createTool({
	id: "fetch-personas",
	description:
		"Fetch personas from a project with filtering and people counts. Personas represent user archetypes and target customer segments.",
	inputSchema: z.object({
		projectId: z
			.string()
			.optional()
			.describe("Project ID to fetch personas from. Defaults to the current project in context."),
		personasSearch: z
			.string()
			.optional()
			.describe("Case-insensitive search string to match persona names or descriptions."),
		limit: z.number().int().min(1).max(100).optional().describe("Maximum number of personas to return."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		projectId: z.string().nullable().optional(),
		personas: z.array(personasDetailSchema),
		totalCount: z.number(),
		searchApplied: z.string().nullable(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = runtimeContext?.get?.("project_id")
		const runtimeAccountId = runtimeContext?.get?.("account_id")

		// biome-ignore lint/suspicious/noExplicitAny: TypeScript inference limitation with Mastra ToolExecutionContext
		const projectId = (context as any).projectId ?? runtimeProjectId ?? null
		// biome-ignore lint/suspicious/noExplicitAny: TypeScript inference limitation with Mastra ToolExecutionContext
		const personasSearch = (context as any).personasSearch ?? ""
		// biome-ignore lint/suspicious/noExplicitAny: TypeScript inference limitation with Mastra ToolExecutionContext
		const limit = (context as any).limit ?? 50

		const sanitizedPersonasSearch = personasSearch.trim().toLowerCase()

		consola.info("fetch-personas: execute start", {
			projectId,
			accountId: runtimeAccountId,
			personasSearch: sanitizedPersonasSearch,
			limit,
		})

		if (!projectId) {
			consola.warn("fetch-personas: missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				projectId: null,
				personas: [],
				totalCount: 0,
				searchApplied: null,
			}
		}

		try {
			// Use the centralized database function
			const projectIdStr = projectId as string
			const accountIdStr = runtimeAccountId as string
			const { data: personasData, error } = await getPersonas({
				supabase,
				projectId: projectIdStr,
			})

			if (error) {
				consola.error("fetch-personas: failed to fetch personas", error)
				throw error
			}

			// Generate route definitions for URL generation
			const projectPath = accountIdStr && projectIdStr ? `/a/${accountIdStr}/${projectIdStr}` : ""
			const routes = createRouteDefinitions(projectPath)

			let personas = (personasData || []).map((persona) => ({
				id: persona.id,
				name: persona.name,
				description: persona.description,
				colorHex: persona.color_hex,
				primaryGoal: persona.primary_goal,
				motivations: persona.motivations,
				frustrations: persona.frustrations,
				peopleCount: Array.isArray(persona.people_personas)
					? persona.people_personas.length
					: typeof persona.people_personas === "number"
						? persona.people_personas
						: 0,
				createdAt: persona.created_at ? new Date(persona.created_at).toISOString() : null,
				updatedAt: persona.updated_at ? new Date(persona.updated_at).toISOString() : null,
				url: projectPath ? `${HOST}${routes.personas.detail(persona.id)}` : null,
			}))

			// Apply search filtering if provided
			if (sanitizedPersonasSearch) {
				personas = personas.filter((persona) => {
					const searchableText = [persona.name, persona.description, persona.primaryGoal]
						.filter(Boolean)
						.join(" ")
						.toLowerCase()

					return (
						searchableText.includes(sanitizedPersonasSearch) ||
						persona.motivations?.some((motivation) => motivation.toLowerCase().includes(sanitizedPersonasSearch)) ||
						persona.frustrations?.some((frustration) => frustration.toLowerCase().includes(sanitizedPersonasSearch))
					)
				})
			}

			// Apply limit
			const limitedPersonas = personas.slice(0, limit)

			const message = sanitizedPersonasSearch
				? `Found ${limitedPersonas.length} personas matching "${personasSearch}".`
				: `Retrieved ${limitedPersonas.length} personas.`

			return {
				success: true,
				message,
				projectId: projectIdStr,
				personas: limitedPersonas,
				totalCount: personas.length,
				searchApplied: sanitizedPersonasSearch || null,
			}
		} catch (error) {
			consola.error("fetch-personas: unexpected error", error)
			return {
				success: false,
				message: "Unexpected error fetching personas.",
				projectId,
				personas: [],
				totalCount: 0,
				searchApplied: null,
			}
		}
	},
})
