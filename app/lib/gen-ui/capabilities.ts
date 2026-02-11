/**
 * Capabilities Validation
 *
 * Validates an A2UI surface against a CapabilitiesSnapshot to ensure
 * the agent only uses components and actions the client can render.
 */

import type { A2UIComponent, CapabilitiesSnapshot } from "./a2ui"

export type CapabilitiesError = {
	path: string
	message: string
}

export function validateComponentsAgainstCapabilities(
	components: A2UIComponent[],
	capabilities: CapabilitiesSnapshot,
): { ok: boolean; errors: CapabilitiesError[] } {
	const errors: CapabilitiesError[] = []
	const allowedComponents = new Set(capabilities.components)
	const componentProps = capabilities.componentProps ?? {}

	for (const comp of components) {
		// Each component's type is the first key in the component record
		const componentType = Object.keys(comp.component)[0]
		if (!componentType) {
			errors.push({ path: comp.id, message: "Component has no type key" })
			continue
		}

		if (!allowedComponents.has(componentType)) {
			errors.push({
				path: comp.id,
				message: `Component '${componentType}' is not in allowlist`,
			})
		}

		// Validate props if componentProps is defined for this type
		const allowedProps = componentProps[componentType]
		if (allowedProps) {
			const allowed = new Set(allowedProps)
			const props = comp.component[componentType]
			if (props && typeof props === "object") {
				for (const prop of Object.keys(props as Record<string, unknown>)) {
					if (!allowed.has(prop)) {
						errors.push({
							path: `${comp.id}.${componentType}`,
							message: `Prop '${prop}' is not allowed on '${componentType}'`,
						})
					}
				}
			}
		}
	}

	return { ok: errors.length === 0, errors }
}
