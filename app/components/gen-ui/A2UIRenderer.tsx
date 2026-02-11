/**
 * A2UI Renderer
 *
 * Renders a flat adjacency list of A2UI components using the component registry.
 * Replaces the old GenUiCanvas (413 lines) with a generic, registry-driven renderer.
 *
 * Responsibilities:
 * - Walk the adjacency list starting from rootId
 * - Resolve data bindings from the surface data model
 * - Render registered custom components via componentRegistry
 * - Emit user actions back to the parent via onAction callback
 */

import { X } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { A2UIComponent, SurfaceState } from "~/lib/gen-ui/a2ui";
import { componentRegistry } from "~/lib/gen-ui/component-registry";
import { resolvePointer } from "~/lib/gen-ui/data-binding";

// Ensure components are registered
import "~/lib/gen-ui/registered-components";

export interface A2UIAction {
	componentId: string;
	componentType: string;
	actionName: string;
	payload?: Record<string, unknown>;
}

interface A2UIRendererProps {
	surface: SurfaceState;
	onAction?: (action: A2UIAction) => void;
	onDismiss?: () => void;
	isStreaming?: boolean;
}

/**
 * Render a single A2UI component node.
 * Looks up the component type in the registry and passes resolved data.
 */
function RenderNode({
	node,
	surface,
	onAction,
	isStreaming,
}: {
	node: A2UIComponent;
	surface: SurfaceState;
	onAction?: (action: A2UIAction) => void;
	isStreaming?: boolean;
}) {
	// The component type is the first key in the component record
	const componentType = Object.keys(node.component)[0];
	if (!componentType) return null;

	const definition = componentRegistry.get(componentType);
	if (!definition) {
		return (
			<div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm">
				Unknown component: <code>{componentType}</code>
			</div>
		);
	}

	// Resolve data: check if the component props contain a data binding path,
	// otherwise use the raw props from the component record
	const rawProps = node.component[componentType] as Record<string, unknown> | undefined;

	// If rawProps has a dataBinding path, resolve it from the data model
	let resolvedData: unknown = rawProps;
	if (rawProps?.dataBinding && typeof rawProps.dataBinding === "string") {
		resolvedData = resolvePointer(surface.dataModel, rawProps.dataBinding as string);
	} else if (rawProps?.path && typeof rawProps.path === "string") {
		resolvedData = resolvePointer(surface.dataModel, rawProps.path as string);
	}

	// Validate against schema
	const validation = definition.schema.safeParse(resolvedData ?? rawProps);
	if (!validation.success) {
		return (
			<div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
				<p className="font-medium">Invalid data for {componentType}</p>
				<pre className="mt-1 text-muted-foreground text-xs">
					{validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}
				</pre>
			</div>
		);
	}

	const Component = definition.component;

	// Create a bound onAction that includes the component ID and type
	const handleAction = onAction
		? (actionName: string, payload?: Record<string, unknown>) => {
				onAction({ componentId: node.id, componentType, actionName, payload });
			}
		: undefined;

	return <Component data={validation.data} isStreaming={isStreaming} onAction={handleAction} />;
}

/**
 * Main A2UI surface renderer.
 * Takes a SurfaceState and renders all components starting from the root.
 */
export function A2UIRenderer({ surface, onAction, onDismiss, isStreaming }: A2UIRendererProps) {
	// Find root component
	const rootNode = useMemo(() => {
		if (!surface.rootId) {
			// If no rootId, render the first component
			const first = surface.components.values().next();
			return first.done ? null : first.value;
		}
		return surface.components.get(surface.rootId) ?? null;
	}, [surface.rootId, surface.components]);

	const handleDismiss = useCallback(() => {
		onDismiss?.();
	}, [onDismiss]);

	if (!rootNode || surface.components.size === 0) {
		return null;
	}

	// Determine display title from root component type
	const componentType = Object.keys(rootNode.component)[0] ?? "Component";
	const definition = componentRegistry.get(componentType);
	const title = definition?.type ?? componentType;

	return (
		<Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="text-base">{title}</CardTitle>
				{onDismiss && (
					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
						<X className="h-4 w-4" />
					</Button>
				)}
			</CardHeader>
			<CardContent className="space-y-3">
				{Array.from(surface.components.values()).map((node) => (
					<RenderNode key={node.id} node={node} surface={surface} onAction={onAction} isStreaming={isStreaming} />
				))}
			</CardContent>
		</Card>
	);
}
