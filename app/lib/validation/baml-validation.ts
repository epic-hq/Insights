import { z } from "zod"
import type { Anchor as BamlAnchor, EvidenceUnit as BamlEvidenceUnit, KindTags } from "~/../baml_client/types"

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

const anchorSchema = z
	.object({
		type: z.string().optional(),
		target: z.string().nullable().optional(),
		start: z.union([z.string(), z.number()]).nullable().optional(),
		end: z.union([z.string(), z.number()]).nullable().optional(),
		start_ms: z.number().nullable().optional(),
		end_ms: z.number().nullable().optional(),
		speaker: z.string().nullable().optional(),
		chapter_title: z.string().nullable().optional(),
		char_span: z.union([z.array(z.number()), z.tuple([z.number(), z.number()]), z.null()]).optional(),
		media_key: z.string().nullable().optional(),
	})
	.passthrough()

const anchorsSchema = z.preprocess((value) => {
	if (Array.isArray(value)) return value
	if (value == null) return []
	return [value]
}, z.array(anchorSchema))

const kindTagsSchema = z
	.object({
		problem: primitiveStringArray,
		goal: primitiveStringArray,
		behavior: primitiveStringArray,
		emotion: z.string().nullable().optional(),
		context: primitiveStringArray,
		artifact: primitiveStringArray,
	})
	.passthrough()
	.default({})

export const evidenceUnitSchema = z
	.object({
		person_key: z.string().min(1, "person_key is required").optional(),
		person_role: nullableString,
		topic: nullableString,
		gist: nullableString,
		chunk: nullableString,
		verbatim: nullableString,
		support: nullableString,
		kind_tags: kindTagsSchema,
		personas: primitiveStringArray,
		segments: primitiveStringArray,
		journey_stage: nullableString,
		anchors: anchorsSchema,
		confidence: nullableString,
		context_summary: nullableString,
		independence_key: nullableString,
		why_it_matters: nullableString,
		facet_mentions: z
			.array(
				z
					.object({
						person_key: z.string(),
						kind_slug: z.string(),
						value: z.string(),
						quote: nullableString,
					})
					.passthrough()
			)
			.optional(),
		isQuestion: z.boolean().nullable().optional(),
		says: primitiveStringArray,
		does: primitiveStringArray,
		thinks: primitiveStringArray,
		feels: primitiveStringArray,
		pains: primitiveStringArray,
		gains: primitiveStringArray,
	})
	.passthrough()

export const evidenceUnitsSchema = z.array(evidenceUnitSchema)

export type EvidenceUnitInput = z.infer<typeof evidenceUnitSchema>
type AnchorInput = z.infer<typeof anchorSchema>

interface NormalizeEvidenceOptions {
	defaultAnchorTarget?: string
	defaultAnchorType?: string
	defaultSupport?: string
	defaultConfidence?: string
}

const DEFAULT_ANCHOR_TYPE = "transcript"
const DEFAULT_SUPPORT = "supports"
const DEFAULT_CONFIDENCE = "medium"

const trimOrUndefined = (value: unknown): string | undefined => {
	if (typeof value === "string") {
		const trimmed = value.trim()
		return trimmed.length ? trimmed : undefined
	}
	return undefined
}

const chooseString = (...values: Array<string | undefined>): string | undefined => {
	for (const value of values) {
		const trimmed = trimOrUndefined(value)
		if (trimmed) return trimmed
	}
	return undefined
}

const toSecondsString = (value: unknown): { secondsString?: string; milliseconds?: number } => {
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

type NormalizedAnchor = (BamlAnchor & {
	start_ms?: number | null
	end_ms?: number | null
	char_span?: number[] | null
	media_key?: string | null
})

const normalizeAnchor = (
	anchor: AnchorInput,
	options: NormalizeEvidenceOptions
): NormalizedAnchor => {
	const defaultTarget = options.defaultAnchorTarget ?? ""
	const defaultType = options.defaultAnchorType ?? DEFAULT_ANCHOR_TYPE

	const startFromMs = toSecondsString(anchor.start_ms ?? undefined)
	const startFromStart = toSecondsString(anchor.start ?? undefined)
	const endFromMs = toSecondsString(anchor.end_ms ?? undefined)
	const endFromEnd = toSecondsString(anchor.end ?? undefined)

	const start = chooseString(
		startFromStart.secondsString,
		startFromMs.secondsString,
		anchor.start ? String(anchor.start) : undefined,
		"0"
	)!

	const end = chooseString(
		endFromEnd.secondsString,
		endFromMs.secondsString,
		anchor.end ? String(anchor.end) : undefined
	)

	const normalized: NormalizedAnchor = {
		type: trimOrUndefined(anchor.type) ?? defaultType,
		target: (trimOrUndefined(anchor.target) ?? defaultTarget) || defaultType,
		start,
		end: end ?? null,
		speaker: trimOrUndefined(anchor.speaker) ?? null,
		chapter_title: trimOrUndefined(anchor.chapter_title) ?? null,
		start_ms: startFromStart.milliseconds ?? startFromMs.milliseconds ?? null,
		end_ms: endFromEnd.milliseconds ?? endFromMs.milliseconds ?? null,
		char_span: Array.isArray(anchor.char_span) ? anchor.char_span : null,
		media_key: trimOrUndefined(anchor.media_key) ?? null,
	}

	return normalized
}

const normalizeKindTags = (kindTags: KindTags | undefined): KindTags => {
	if (!kindTags) return {}
	const normalized: KindTags = {}
	for (const [key, value] of Object.entries(kindTags)) {
		if (Array.isArray(value)) {
			const cleaned = value
				.map((item) => (typeof item === "string" ? item.trim() : undefined))
				.filter((item): item is string => Boolean(item))
			if (cleaned.length) {
				;(normalized as Record<string, unknown>)[key] = cleaned
			}
		} else if (typeof value === "string") {
			const trimmed = value.trim()
			if (trimmed.length) {
				;(normalized as Record<string, unknown>)[key] = trimmed
			}
		} else if (value != null) {
			;(normalized as Record<string, unknown>)[key] = value
		}
	}
	return normalized
}

const normalizeEvidenceUnit = (
	unit: EvidenceUnitInput,
	options: NormalizeEvidenceOptions
): (BamlEvidenceUnit & Record<string, unknown>) => {
	const support = chooseString(unit.support) ?? options.defaultSupport ?? DEFAULT_SUPPORT
	const confidence = chooseString(unit.confidence) ?? options.defaultConfidence ?? DEFAULT_CONFIDENCE

	const gist = chooseString(unit.gist, unit.chunk, unit.verbatim) ?? ""
	const chunk = chooseString(unit.chunk, unit.verbatim, gist) ?? gist
	const verbatim = chooseString(unit.verbatim, unit.chunk, gist) ?? chunk

	const anchorInputs = Array.isArray(unit.anchors) ? unit.anchors : []
	const normalizedAnchors = anchorInputs.map((anchor) => normalizeAnchor(anchor, options))
	if (!normalizedAnchors.length) {
		normalizedAnchors.push(
			normalizeAnchor(
				{
					type: options.defaultAnchorType ?? DEFAULT_ANCHOR_TYPE,
					target: options.defaultAnchorTarget ?? "",
					start: "0",
				},
				options
			)
		)
	}

	const normalized: BamlEvidenceUnit & Record<string, unknown> = {
		person_key: unit.person_key ?? "unknown-person",
		person_role: chooseString(unit.person_role) ?? null,
		topic: chooseString(unit.topic) ?? null,
		gist,
		chunk,
		verbatim,
		support,
		kind_tags: normalizeKindTags(unit.kind_tags as KindTags | undefined),
		personas: unit.personas ?? null,
		segments: unit.segments ?? null,
		journey_stage: chooseString(unit.journey_stage) ?? null,
		anchors: normalizedAnchors,
		confidence,
		context_summary: chooseString(unit.context_summary) ?? null,
		independence_key: chooseString(unit.independence_key) ?? null,
		says: unit.says ?? null,
		does: unit.does ?? null,
		thinks: unit.thinks ?? null,
		feels: unit.feels ?? null,
		pains: unit.pains ?? null,
		gains: unit.gains ?? null,
	}

	if (unit.why_it_matters) {
		normalized.why_it_matters = unit.why_it_matters
	}
	if (unit.facet_mentions) {
		normalized.facet_mentions = unit.facet_mentions
	}
	if (typeof unit.isQuestion === "boolean") {
		normalized.isQuestion = unit.isQuestion
	}

	return normalized
}

export const normalizeEvidenceUnits = (
	units: unknown,
	options: NormalizeEvidenceOptions = {}
) => {
	const parsed = evidenceUnitsSchema.parse(Array.isArray(units) ? units : [])
	return parsed.map((unit) => normalizeEvidenceUnit(unit, options))
}
