import type { A2UIComponent, SurfaceState } from "./a2ui";
import { resolveTemplateData } from "./data-binding";

export interface RenderPlanNode {
	key: string;
	node: A2UIComponent;
	depth: number;
	actionComponentId: string;
	dataScopePath?: string;
}

function getRawProps(node: A2UIComponent): Record<string, unknown> | undefined {
	const componentType = Object.keys(node.component)[0];
	if (!componentType) return undefined;
	const value = node.component[componentType];
	return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function getExplicitChildren(rawProps: Record<string, unknown> | undefined): string[] {
	if (!rawProps) return [];
	const children = rawProps.children;
	if (!children || typeof children !== "object") return [];
	const explicitList = (children as { explicitList?: unknown }).explicitList;
	if (!Array.isArray(explicitList)) return [];
	return explicitList.filter((id): id is string => typeof id === "string");
}

function getTemplateChild(
	rawProps: Record<string, unknown> | undefined
): { dataBinding: string; componentId: string } | null {
	if (!rawProps) return null;
	const children = rawProps.children;
	if (!children || typeof children !== "object") return null;
	const template = (children as { template?: unknown }).template;
	if (!template || typeof template !== "object") return null;
	const candidate = template as {
		dataBinding?: unknown;
		componentId?: unknown;
	};
	if (
		typeof candidate.dataBinding !== "string" ||
		typeof candidate.componentId !== "string" ||
		!candidate.dataBinding.startsWith("/")
	) {
		return null;
	}
	return {
		dataBinding: candidate.dataBinding,
		componentId: candidate.componentId,
	};
}

function buildTemplateScopePath(basePath: string, index: number): string {
	if (basePath === "/") return `/${index}`;
	return `${basePath}/${index}`;
}

export function buildRenderPlan(surface: SurfaceState): RenderPlanNode[] {
	if (surface.components.size === 0) return [];

	const rootNode = surface.rootId
		? (surface.components.get(surface.rootId) ?? null)
		: (surface.components.values().next().value ?? null);
	if (!rootNode) return [];

	const plan: RenderPlanNode[] = [];

	const walk = (nodeId: string, depth: number, dataScopePath: string | undefined, ancestry: Set<string>) => {
		const node = surface.components.get(nodeId);
		if (!node) return;

		const ancestryKey = `${nodeId}|${dataScopePath ?? "<root>"}`;
		if (ancestry.has(ancestryKey)) return;
		const nextAncestry = new Set(ancestry);
		nextAncestry.add(ancestryKey);

		const actionComponentId = dataScopePath ? `${node.id}@${dataScopePath}` : node.id;
		plan.push({
			key: `${actionComponentId}#${plan.length}`,
			node,
			depth,
			actionComponentId,
			dataScopePath,
		});

		const rawProps = getRawProps(node);
		const explicitChildren = getExplicitChildren(rawProps);
		for (const childId of explicitChildren) {
			walk(childId, depth + 1, dataScopePath, nextAncestry);
		}

		const templateChild = getTemplateChild(rawProps);
		if (!templateChild) return;

		const items = resolveTemplateData(surface.dataModel, templateChild.dataBinding);
		for (let index = 0; index < items.length; index += 1) {
			walk(
				templateChild.componentId,
				depth + 1,
				buildTemplateScopePath(templateChild.dataBinding, index),
				nextAncestry
			);
		}
	};

	walk(rootNode.id, 0, undefined, new Set<string>());
	return plan;
}
