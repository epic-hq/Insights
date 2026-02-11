/**
 * A2UI Types — Flat Adjacency List Model
 *
 * Aligned with a2ui.org v0.8 spec:
 * - Components are flat, referenced by ID (not nested)
 * - Data binding via JSON Pointer paths separates structure from state
 * - 4 message types: surfaceUpdate, dataModelUpdate, beginRendering, deleteSurface
 *
 * Key difference from codex-genui branch: flat list vs nested tree.
 * Flat is LLM-friendly (streamable, incrementally updatable).
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Value Binding — literal or data-bound via JSON Pointer
// ---------------------------------------------------------------------------

export const literalValueSchema = z.object({
	literalString: z.string().optional(),
	literalNumber: z.number().optional(),
	literalBool: z.boolean().optional(),
})

export const pathValueSchema = z.object({
	path: z.string().startsWith("/"),
})

export const valueBindingSchema = z.union([literalValueSchema, pathValueSchema])

export type ValueBinding = z.infer<typeof valueBindingSchema>

// ---------------------------------------------------------------------------
// Children — static (explicitList) or dynamic (template)
// ---------------------------------------------------------------------------

export const explicitChildrenSchema = z.object({
	explicitList: z.array(z.string()),
})

export const templateChildrenSchema = z.object({
	template: z.object({
		dataBinding: z.string().startsWith("/"),
		componentId: z.string(),
	}),
})

export const childrenSchema = z.union([explicitChildrenSchema, templateChildrenSchema])

export type Children = z.infer<typeof childrenSchema>

// ---------------------------------------------------------------------------
// Action — user interaction that emits an event
// ---------------------------------------------------------------------------

export const actionSchema = z.object({
	name: z.string(),
	payload: z.record(z.string(), z.unknown()).optional(),
})

export type Action = z.infer<typeof actionSchema>

// ---------------------------------------------------------------------------
// Component — flat node in the adjacency list
// ---------------------------------------------------------------------------

export const a2uiComponentSchema = z.object({
	/** Unique ID within the surface */
	id: z.string().min(1),
	/** Component type — either standard catalog or custom registered type */
	component: z.record(z.string(), z.unknown()),
})

export type A2UIComponent = z.infer<typeof a2uiComponentSchema>

// ---------------------------------------------------------------------------
// Message Types (a2ui.org v0.8)
// ---------------------------------------------------------------------------

export const surfaceUpdateSchema = z.object({
	type: z.literal("surfaceUpdate"),
	surfaceId: z.string(),
	/** Flat list of components — order doesn't matter, parent-child via ID refs */
	components: z.array(a2uiComponentSchema),
	/** Root component ID */
	rootId: z.string().optional(),
})

export const dataModelUpdateSchema = z.object({
	type: z.literal("dataModelUpdate"),
	surfaceId: z.string(),
	/** Full or partial data model — merged into existing state */
	data: z.record(z.string(), z.unknown()),
})

export const beginRenderingSchema = z.object({
	type: z.literal("beginRendering"),
	surfaceId: z.string(),
})

export const deleteSurfaceSchema = z.object({
	type: z.literal("deleteSurface"),
	surfaceId: z.string(),
})

export const a2uiMessageSchema = z.discriminatedUnion("type", [
	surfaceUpdateSchema,
	dataModelUpdateSchema,
	beginRenderingSchema,
	deleteSurfaceSchema,
])

export type SurfaceUpdate = z.infer<typeof surfaceUpdateSchema>
export type DataModelUpdate = z.infer<typeof dataModelUpdateSchema>
export type BeginRendering = z.infer<typeof beginRenderingSchema>
export type DeleteSurface = z.infer<typeof deleteSurfaceSchema>
export type A2UIMessage = z.infer<typeof a2uiMessageSchema>

// ---------------------------------------------------------------------------
// Surface State — held by the renderer
// ---------------------------------------------------------------------------

export interface SurfaceState {
	surfaceId: string
	/** Component lookup by ID */
	components: Map<string, A2UIComponent>
	/** Root component ID */
	rootId: string | null
	/** Data model for data binding */
	dataModel: Record<string, unknown>
	/** Whether beginRendering has been received */
	ready: boolean
}

export function createEmptySurface(surfaceId: string): SurfaceState {
	return {
		surfaceId,
		components: new Map(),
		rootId: null,
		dataModel: {},
		ready: false,
	}
}

/**
 * Apply an A2UI message to a surface, returning the updated state.
 * Immutable — returns a new object.
 */
export function applySurfaceMessage(surface: SurfaceState, message: A2UIMessage): SurfaceState {
	switch (message.type) {
		case "surfaceUpdate": {
			const next = {
				...surface,
				components: new Map(surface.components),
				rootId: message.rootId ?? surface.rootId,
			}
			for (const comp of message.components) {
				next.components.set(comp.id, comp)
			}
			return next
		}
		case "dataModelUpdate": {
			return {
				...surface,
				dataModel: { ...surface.dataModel, ...message.data },
			}
		}
		case "beginRendering": {
			return { ...surface, ready: true }
		}
		case "deleteSurface": {
			return createEmptySurface(surface.surfaceId)
		}
	}
}

// ---------------------------------------------------------------------------
// Capabilities Snapshot — what the client can render
// ---------------------------------------------------------------------------

export const capabilitiesSnapshotSchema = z.object({
	components: z.array(z.string()).default([]),
	actions: z.array(z.string()).default([]),
	componentProps: z.record(z.string(), z.array(z.string())).optional(),
})

export type CapabilitiesSnapshot = z.infer<typeof capabilitiesSnapshotSchema>

// ---------------------------------------------------------------------------
// Artifact — persisted A2UI surface + data model (for event store)
// ---------------------------------------------------------------------------

export const a2uiArtifactSchema = z.object({
	surfaceId: z.string(),
	components: z.array(a2uiComponentSchema),
	rootId: z.string().optional(),
	dataModel: z.record(z.string(), z.unknown()),
	capabilitiesSnapshot: capabilitiesSnapshotSchema,
})

export type A2UIArtifact = z.infer<typeof a2uiArtifactSchema>
