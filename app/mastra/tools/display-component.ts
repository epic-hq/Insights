/**
 * Generic displayComponent Tool
 *
 * A single Mastra tool that can render ANY registered gen-ui component.
 * The agent picks the right component based on the registry's useWhen hints.
 *
 * This replaces the need for one tool per component — all 12+ components
 * are available through this single tool.
 */

import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

import { componentRegistry } from "~/lib/gen-ui/component-registry"
import { buildSingleComponentSurface, withA2UI } from "~/lib/gen-ui/tool-helpers"

const baseOutputSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	componentType: z.string().optional(),
})

export const displayComponentTool = createTool({
	id: "display-component",
	description: buildToolDescription(),
	inputSchema: z.object({
		componentType: z
			.string()
			.describe(
				"The registered component type to render. Must exactly match one of the available component types listed in the tool description."
			),
		data: z
			.record(z.unknown())
			.describe("The data to pass to the component. Must conform to the component's schema."),
		title: z
			.string()
			.optional()
			.describe("Optional title for the surface — used in UI chrome around the rendered component."),
	}),
	outputSchema: withA2UI(baseOutputSchema),
	execute: async (input, context?) => {
		const project_id = context?.requestContext?.get?.("project_id") as string | undefined
		const thread_id = context?.requestContext?.get?.("thread_id") as string | undefined

		const { componentType, data, title } = input

		consola.info("[gen-ui] displayComponent called", {
			componentType,
			project_id,
			dataKeys: Object.keys(data),
		})

		// Validate the component type exists in the registry
		const definition = componentRegistry.get(componentType)
		if (!definition) {
			const available = componentRegistry.getAll().map((c) => c.type)
			return {
				success: false,
				message: `Unknown component type "${componentType}". Available: ${available.join(", ")}`,
				componentType,
			}
		}

		// Validate data against the component's schema
		const validation = componentRegistry.validateProps(componentType, data)
		if (!validation.success) {
			consola.warn("[gen-ui] displayComponent data validation failed", {
				componentType,
				errors: validation.errors,
			})
			return {
				success: false,
				message: `Data validation failed for "${componentType}": ${String(validation.errors)}`,
				componentType,
			}
		}

		const surfaceId = thread_id ?? project_id ?? `surface-${Date.now()}`

		return {
			success: true,
			message: `Rendering ${componentType}${title ? `: ${title}` : ""}`,
			componentType,
			a2ui: buildSingleComponentSurface({
				surfaceId,
				componentType,
				data: validation.data as Record<string, unknown>,
			}),
		}
	},
})

/**
 * Build the tool description dynamically from the component registry.
 * Includes all available components, their descriptions, and when to use them.
 */
function buildToolDescription(): string {
	const lines = [
		"Render a rich UI component on the user's canvas. Use this when the response benefits from a visual display rather than plain text.",
		"",
		"IMPORTANT: You MUST pass 'data' that conforms to each component's expected schema. See component details below.",
		"",
	]

	const components = componentRegistry.getAll()
	if (components.length > 0) {
		lines.push("Available components:")
		lines.push("")
		for (const comp of components) {
			lines.push(`• ${comp.type} — ${comp.description}`)
			lines.push(`  Use when: ${comp.useWhen}`)
			if (comp.triggerExamples?.length) {
				lines.push(`  Triggers: ${comp.triggerExamples.join(", ")}`)
			}
			lines.push("")
		}
	}

	return lines.join("\n")
}
