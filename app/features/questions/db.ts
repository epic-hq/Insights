import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"

type JSONValue = string | number | boolean | null | JSONValue[] | { [k: string]: JSONValue }

export interface ProjectContextGeneric {
	/** Deep merge across ALL kinds */
	merged: Record<string, JSONValue>
	/** Deep merge grouped by kind */
	byKind: Record<string, Record<string, JSONValue>>
	/** Last writer for each top-level key in `merged` */
	provenance: Record<string, { section_id: string; kind: string; updated_at: string | null }>
}

type SectionRow = {
	id: string
	kind: string
	meta: Record<string, JSONValue> | null
	updated_at: string | null
}

/** Deep merge: arrays union (by primitive identity), objects recurse, scalars take newer */
function deepMergeWithTime(
	base: JSONValue,
	incoming: JSONValue,
	baseTs: number,
	incomingTs: number
): JSONValue {
	// Arrays → union
	if (Array.isArray(base) && Array.isArray(incoming)) {
		const s = new Set<JSONValue>(base)
		for (const v of incoming) s.add(v)
		return Array.from(s)
	}

	// Objects → recurse
	if (isPlainObject(base) && isPlainObject(incoming)) {
		const out: Record<string, JSONValue> = { ...base }
		const keys = new Set([...Object.keys(base), ...Object.keys(incoming)])
		for (const k of keys) {
			const bv = (base as any)[k] as JSONValue
			const iv = (incoming as any)[k] as JSONValue
			if (bv === undefined) out[k] = iv
			else if (iv === undefined) out[k] = bv
			else out[k] = deepMergeWithTime(bv, iv, baseTs, incomingTs)
		}
		return out
	}

	// Fallback (scalars or mismatched types)
	// Prefer newer, BUT do not overwrite non-empty scalars with empty-like values
	const newerWins = incomingTs >= baseTs
	if (!newerWins) return base

	// If both are strings, prevent replacing non-empty with empty
	if (typeof base === "string" && typeof incoming === "string") {
		const baseTrim = base.trim()
		const incTrim = incoming.trim()
		if (baseTrim.length > 0 && incTrim.length === 0) return base
		return incoming
	}

	// If base is non-null/defined scalar and incoming is null, keep base
	if ((base !== null && base !== undefined) && (incoming === null || incoming === undefined)) {
		return base
	}

	return incoming
}

function isPlainObject(v: unknown): v is Record<string, JSONValue> {
	return typeof v === "object" && v != null && !Array.isArray(v)
}

export async function getProjectContextGeneric(
	supabase: SupabaseClient,
	projectId: string,
	opts?: { include_by_kind?: boolean; include_provenance?: boolean }
): Promise<ProjectContextGeneric | null> {
	try {
		const { data, error } = await supabase
			.from("project_sections")
			.select("id, kind, meta, updated_at")
			.eq("project_id", projectId)

		if (error) {
			consola.warn("Error loading project sections:", error)
			return null
		}

		const sections = (data ?? []).filter((s): s is SectionRow => !!s && !!s.meta)
		consola.log("sections:", sections)

		// Sort ascending so later (newer) wins deterministically in merges
		if (sections.length > 1) {
			sections.sort((a, b) => (Date.parse(a.updated_at ?? "0") - Date.parse(b.updated_at ?? "0")))
		}

		const result: ProjectContextGeneric = {
			merged: {},
			byKind: {},
			provenance: {},
		}

		const includeByKind = opts?.include_by_kind === true
		const includeProvenance = opts?.include_provenance === true

		let mergedTs = 0
		for (const s of sections) {
			const ts = Date.parse(s.updated_at ?? "0")
			const meta = s.meta ?? {}

			// Global deep merge
			result.merged = isPlainObject(result.merged)
				? (deepMergeWithTime(result.merged, meta, mergedTs, ts) as Record<string, JSONValue>)
				: (meta as Record<string, JSONValue>)
			mergedTs = Math.max(mergedTs, ts)

			// Per-kind deep merge (optional)
			if (includeByKind) {
				const prevKind = result.byKind[s.kind] ?? {}
				result.byKind[s.kind] = isPlainObject(prevKind)
					? (deepMergeWithTime(prevKind, meta, 0, ts) as Record<string, JSONValue>)
					: (meta as Record<string, JSONValue>)
			}

			// Provenance (top-level keys): last writer wins (optional)
			if (includeProvenance) {
				for (const k of Object.keys(meta)) {
					const p = result.provenance[k]
					if (!p || ts >= Date.parse(p.updated_at ?? "0")) {
						result.provenance[k] = { section_id: s.id, kind: s.kind, updated_at: s.updated_at }
					}
				}
			}
		}

		return result
	} catch (err) {
		consola.warn("Error in getProjectContextGeneric:", err)
		return null
	}
}
