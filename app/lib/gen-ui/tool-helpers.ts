/**
 * Tool Helpers for A2UI
 *
 * Utilities for agent tools to produce A2UI messages as part of their tool results.
 * The chat frontend detects these messages and feeds them to the A2UI renderer.
 *
 * Pattern:
 *   Tool execute() → returns { ...result, a2ui: buildSurface(...) }
 *   Frontend parses tool result → detects a2ui key → applyMessages()
 */

import { z } from "zod";
import type { A2UIMessage, CapabilitiesSnapshot } from "./a2ui";
import { componentRegistry } from "./component-registry";

/**
 * Payload shape embedded in tool results for the frontend to detect.
 */
export interface A2UIToolPayload {
	/** Marker for frontend detection */
	__a2ui: true;
	/** The surface ID (usually thread-scoped) */
	surfaceId: string;
	/** Ordered A2UI messages to apply */
	messages: A2UIMessage[];
}

/**
 * Build a complete A2UI surface from a single registered component.
 *
 * This is the most common pattern: a tool wants to show one component
 * with its data. This helper produces the 3-message sequence:
 *   surfaceUpdate → dataModelUpdate → beginRendering
 */
export function buildSingleComponentSurface(input: {
	surfaceId: string;
	componentType: string;
	componentId?: string;
	data: Record<string, unknown>;
}): A2UIToolPayload {
	const { surfaceId, componentType, data } = input;
	const componentId = input.componentId ?? `${componentType.toLowerCase()}-root`;

	const messages: A2UIMessage[] = [
		{
			type: "surfaceUpdate",
			surfaceId,
			rootId: componentId,
			components: [
				{
					id: componentId,
					component: {
						[componentType]: {
							dataBinding: "/data",
						},
					},
				},
			],
		},
		{
			type: "dataModelUpdate",
			surfaceId,
			data: { data },
		},
		{
			type: "beginRendering",
			surfaceId,
		},
	];

	return { __a2ui: true, surfaceId, messages };
}

/**
 * Build a dataModelUpdate to update the data for an existing surface.
 * Use this for incremental updates without re-sending the component structure.
 */
export function buildDataUpdate(input: { surfaceId: string; data: Record<string, unknown> }): A2UIToolPayload {
	return {
		__a2ui: true,
		surfaceId: input.surfaceId,
		messages: [
			{
				type: "dataModelUpdate",
				surfaceId: input.surfaceId,
				data: input.data,
			},
		],
	};
}

/**
 * Build a deleteSurface message to dismiss the current UI.
 */
export function buildDismiss(surfaceId: string): A2UIToolPayload {
	return {
		__a2ui: true,
		surfaceId,
		messages: [{ type: "deleteSurface", surfaceId }],
	};
}

/**
 * Detect if a tool result contains an A2UI payload.
 */
export function isA2UIToolPayload(result: unknown): result is { a2ui: A2UIToolPayload } {
	if (!result || typeof result !== "object") return false;
	const r = result as Record<string, unknown>;
	if (!r.a2ui || typeof r.a2ui !== "object") return false;
	return (r.a2ui as Record<string, unknown>).__a2ui === true;
}

/**
 * Get the current capabilities snapshot from the component registry.
 * Pass this to the agent so it knows what components are available.
 */
export function getCapabilitiesSnapshot(): CapabilitiesSnapshot {
	return componentRegistry.getCapabilitiesSnapshot();
}

// ---------------------------------------------------------------------------
// Schema wrapper — makes Mastra preserve a2ui in tool output
// ---------------------------------------------------------------------------

/**
 * Zod schema for the A2UI payload embedded in tool results.
 * Intentionally uses z.any() for messages to avoid coupling the
 * tool schema to the full A2UI message type definitions.
 */
const a2uiPayloadSchema = z
	.object({
		__a2ui: z.literal(true),
		surfaceId: z.string(),
		messages: z.array(z.record(z.string(), z.unknown())),
	})
	.optional();

/**
 * Extend a tool's outputSchema with an optional `a2ui` field.
 *
 * Mastra validates tool output via `schema.safeParse()` — Zod strips
 * unknown keys by default. This wrapper ensures the a2ui payload
 * survives validation and reaches the frontend.
 *
 * @example
 * ```ts
 * export const myTool = createTool({
 *   outputSchema: withA2UI(z.object({ success: z.boolean(), message: z.string() })),
 *   execute: async (input) => ({
 *     success: true,
 *     message: "Here are your prompts",
 *     a2ui: buildSingleComponentSurface({ ... }),
 *   }),
 * })
 * ```
 */
export function withA2UI<T extends z.ZodRawShape>(baseSchema: z.ZodObject<T>) {
	return baseSchema.extend({ a2ui: a2uiPayloadSchema });
}
