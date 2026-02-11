/**
 * Data Binding — resolve JSON Pointer paths against a data model
 *
 * Used by the A2UI renderer to hydrate component values from the data model.
 * Supports both literal values and path-based bindings.
 */

import type { ValueBinding } from "./a2ui"

/**
 * Parse a JSON Pointer (RFC 6901) into path segments.
 * "/user/name" → ["user", "name"]
 * "/items/0" → ["items", "0"]
 */
export function parseJsonPointer(pointer: string): string[] {
	if (pointer === "" || pointer === "/") return []
	if (!pointer.startsWith("/")) {
		throw new Error(`Invalid JSON Pointer: must start with '/', got '${pointer}'`)
	}
	return pointer
		.slice(1)
		.split("/")
		.map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/**
 * Resolve a JSON Pointer path against a data model.
 * Returns undefined if the path doesn't exist (no throw).
 */
export function resolvePointer(dataModel: Record<string, unknown>, pointer: string): unknown {
	const segments = parseJsonPointer(pointer)
	let current: unknown = dataModel

	for (const segment of segments) {
		if (current === null || current === undefined) return undefined

		if (Array.isArray(current)) {
			const index = Number(segment)
			if (Number.isNaN(index) || index < 0 || index >= current.length) return undefined
			current = current[index]
		} else if (typeof current === "object") {
			current = (current as Record<string, unknown>)[segment]
		} else {
			return undefined
		}
	}

	return current
}

/**
 * Resolve a ValueBinding to a concrete value.
 * - literalString/literalNumber/literalBool → return the literal
 * - path → resolve against the data model
 */
export function resolveBinding(
	binding: ValueBinding | undefined,
	dataModel: Record<string, unknown>,
): unknown {
	if (!binding) return undefined

	if ("path" in binding) {
		return resolvePointer(dataModel, binding.path)
	}

	if ("literalString" in binding && binding.literalString !== undefined) {
		return binding.literalString
	}
	if ("literalNumber" in binding && binding.literalNumber !== undefined) {
		return binding.literalNumber
	}
	if ("literalBool" in binding && binding.literalBool !== undefined) {
		return binding.literalBool
	}

	return undefined
}

/**
 * Resolve a template data binding — returns the array at the given path.
 * Used for dynamic children (template-based lists).
 */
export function resolveTemplateData(
	dataModel: Record<string, unknown>,
	dataBindingPath: string,
): unknown[] {
	const value = resolvePointer(dataModel, dataBindingPath)
	if (Array.isArray(value)) return value
	return []
}
