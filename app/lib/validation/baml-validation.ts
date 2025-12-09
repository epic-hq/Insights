import { z } from "zod"
import type { EvidenceTurn as BamlEvidenceTurn, TurnAnchors } from "~/../baml_client/types"

const nullableString = z
	.union([z.string(), z.number(), z.null()])
	.optional()
	.transform((value) => {
		if (value === null || value === undefined) return undefined
		return String(value)
	})

const primitiveStringArray = z
	.array(nullableString)
	.nullable()
	.optional()
	.transform((value) => {
		if (!Array.isArray(value)) return undefined
		const cleaned = value
			.map((item) => (typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : undefined))
			.filter((item): item is string => Boolean(item && item.length > 0))
		return cleaned.length ? cleaned : undefined
	})

// TurnAnchors schema - single object with integer milliseconds
export const turnAnchorsSchema = z
	.object({
		start_ms: z.number().nullable().optional(),
		end_ms: z.number().nullable().optional(),
		chapter_title: z.string().nullable().optional(),
		char_span: z.union([z.array(z.number()), z.tuple([z.number(), z.number()]), z.null()]).optional(),
	})
	.passthrough()

// For backwards compatibility, accept both single object and array
const anchorsSchema = z.preprocess((value) => {
	// If it's already a TurnAnchors object, use it
	if (value && typeof value === "object" && !Array.isArray(value)) return value
	// If it's an array, take the first element
	if (Array.isArray(value) && value.length > 0) return value[0]
	// Otherwise return null
	return null
}, turnAnchorsSchema.nullable())

// FacetMention schema for evidence facet mentions
const facetMentionSchema = z
	.object({
		person_key: z.string(),
		kind_slug: z.string(),
		value: z.string(),
		quote: nullableString,
	})
	.passthrough()

export const evidenceTurnSchema = z
	.object({
		person_key: z.string().min(1, "person_key is required"),
		speaker_label: nullableString,
		gist: z.string().min(1, "gist is required"),
		chunk: z.string().min(1, "chunk is required"),
		verbatim: z.string().min(1, "verbatim is required"),
		anchors: anchorsSchema,
		why_it_matters: nullableString,
		facet_mentions: z.array(facetMentionSchema).default([]),
		isQuestion: z.boolean().nullable().optional(),
		says: primitiveStringArray,
		does: primitiveStringArray,
		thinks: primitiveStringArray,
		feels: primitiveStringArray,
		pains: primitiveStringArray,
		gains: primitiveStringArray,
	})
	.passthrough()

export const evidenceTurnsSchema = z.array(evidenceTurnSchema)

export type EvidenceTurnInput = z.infer<typeof evidenceTurnSchema>
type TurnAnchorsInput = z.infer<typeof turnAnchorsSchema>

type NormalizeEvidenceOptions = {}

const trimOrUndefined = (value: unknown): string | undefined => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		return trimmed.length ? trimmed : undefined
	}
	return undefined
}

const _chooseString = (...values: Array<string | undefined>): string | undefined => {
	for (const value of values) {
		const trimmed = trimOrUndefined(value)
		if (trimmed) return trimmed
	}
	return undefined
}

const _toSecondsString = (value: unknown): { secondsString?: string; milliseconds?: number } => {
	if (typeof value === "number" && Number.isFinite(value)) {
		const seconds = value >= 1000 ? value / 1000 : value
		return { secondsString: seconds.toString(), milliseconds: Math.round(seconds * 1000) }
	}
	if (typeof value === "string") {
		const parsed = Number.parseFloat(value)
		if (Number.isFinite(parsed)) {
			return {
				secondsString: value.trim(),
				milliseconds: Math.round(parsed * 1000),
			}
		}
	}
	return {}
}

// Normalized TurnAnchors with computed fields
type NormalizedTurnAnchors = TurnAnchors & {
	start_ms: number | null
	end_ms: number | null
	chapter_title: string | null
	char_span: number[] | null
}

const normalizeTurnAnchors = (anchors: TurnAnchorsInput | null): NormalizedTurnAnchors => {
	if (!anchors) {
		return {
			start_ms: null,
			end_ms: null,
			chapter_title: null,
			char_span: null,
		}
	}

	return {
		start_ms: typeof anchors.start_ms === "number" ? anchors.start_ms : null,
		end_ms: typeof anchors.end_ms === "number" ? anchors.end_ms : null,
		chapter_title: trimOrUndefined(anchors.chapter_title) ?? null,
		char_span: Array.isArray(anchors.char_span) ? anchors.char_span : null,
	}
}

const normalizeEvidenceTurn = (
	turn: EvidenceTurnInput,
	_options: NormalizeEvidenceOptions = {}
): BamlEvidenceTurn & Record<string, unknown> => {
	// EvidenceTurn already has required gist, chunk, verbatim from schema
	// No need for fallback logic like old EvidenceUnit

	const normalized: BamlEvidenceTurn & Record<string, unknown> = {
		person_key: turn.person_key,
		speaker_label: trimOrUndefined(turn.speaker_label) ?? null,
		gist: turn.gist,
		chunk: turn.chunk,
		verbatim: turn.verbatim,
		anchors: normalizeTurnAnchors(turn.anchors),
		why_it_matters: trimOrUndefined(turn.why_it_matters) ?? null,
		facet_mentions: turn.facet_mentions ?? [],
		isQuestion: turn.isQuestion ?? null,
		says: turn.says ?? null,
		does: turn.does ?? null,
		thinks: turn.thinks ?? null,
		feels: turn.feels ?? null,
		pains: turn.pains ?? null,
		gains: turn.gains ?? null,
	}

	return normalized
}

export const normalizeEvidenceTurns = (turns: unknown, options: NormalizeEvidenceOptions = {}) => {
	const parsed = evidenceTurnsSchema.parse(Array.isArray(turns) ? turns : [])
	return parsed.map((turn) => normalizeEvidenceTurn(turn, options))
}

// Legacy aliases for backwards compatibility
export const normalizeEvidenceUnits = normalizeEvidenceTurns
export const evidenceUnitsSchema = evidenceTurnsSchema
export const evidenceUnitSchema = evidenceTurnSchema
export type EvidenceUnitInput = EvidenceTurnInput
