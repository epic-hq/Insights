/**
 * Gen-UI — A2UI-aligned generative UI system
 *
 * Core: Flat adjacency list model, data binding, 4 message types
 * Registry: Component definitions with Zod schemas
 * Patch: RFC 6902 JSON Patch for incremental state updates
 */

// A2UI types and surface state
export type {
	A2UIArtifact,
	A2UIComponent,
	A2UIMessage,
	Action,
	BeginRendering,
	CapabilitiesSnapshot,
	Children,
	DataModelUpdate,
	DeleteSurface,
	SurfaceState,
	SurfaceUpdate,
	ValueBinding,
} from "./a2ui";
export {
	a2uiArtifactSchema,
	a2uiComponentSchema,
	a2uiMessageSchema,
	actionSchema,
	applySurfaceMessage,
	beginRenderingSchema,
	capabilitiesSnapshotSchema,
	childrenSchema,
	createEmptySurface,
	dataModelUpdateSchema,
	deleteSurfaceSchema,
	surfaceUpdateSchema,
	valueBindingSchema,
} from "./a2ui";
// Capabilities validation
export type { CapabilitiesError } from "./capabilities";
export { validateComponentsAgainstCapabilities } from "./capabilities";
// Component registry
export type { ComponentDefinition } from "./component-registry";
export { componentRegistry, defineComponent } from "./component-registry";
// Data binding
export {
	parseJsonPointer,
	resolveBinding,
	resolvePointer,
	resolveTemplateData,
} from "./data-binding";

// JSON Patch (RFC 6902)
export type { JsonPatchError, JsonPatchOperation, JsonPatchResult } from "./json-patch";
export {
	applyJsonPatch,
	jsonPatchOperationSchema,
	jsonPatchSchema,
	validateJsonPatch,
} from "./json-patch";
