import { z } from "zod"

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
		person_key: z.string().min(1, "person_key is required"),
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
