/**
 * Default facet kinds for real-time evidence extraction.
 * Shared between the API route and Trigger.dev task.
 */
import type { FacetCatalogKind } from "baml_client";

export const DEFAULT_FACET_KINDS: FacetCatalogKind[] = [
	{ slug: "goal", label: "Goals" },
	{ slug: "pain", label: "Pain Points" },
	{ slug: "behavior", label: "Behaviors" },
	{ slug: "tool", label: "Tools" },
	{ slug: "value", label: "Values" },
	{ slug: "preference", label: "Preferences" },
	{ slug: "workflow", label: "Workflows" },
	{ slug: "feature", label: "Features" },
	{ slug: "emotion", label: "Emotions" },
	{ slug: "context", label: "Context" },
	{ slug: "demographic", label: "Demographics" },
	{ slug: "artifact", label: "Artifacts" },
];
