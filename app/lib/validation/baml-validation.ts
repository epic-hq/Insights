import { z } from "zod"

const primitiveStringArray = z
	.array(z.string().min(1))
	.nullable()
	.optional()
	.transform((value) => (Array.isArray(value) && value.length === 0 ? null : value ?? null))

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
		person_role: z.string().nullable().optional(),
		topic: z.string().nullable().optional(),
		gist: z.string().min(1, "gist is required"),
		chunk: z.string().min(1, "chunk is required"),
		verbatim: z.string().min(1, "verbatim is required"),
		support: z.string().min(1, "support is required"),
		kind_tags: kindTagsSchema,
		personas: primitiveStringArray,
		segments: primitiveStringArray,
		journey_stage: z.string().nullable().optional(),
		anchors: anchorsSchema,
		confidence: z.string().min(1, "confidence is required"),
		context_summary: z.string().nullable().optional(),
		independence_key: z.string().nullable().optional(),
		why_it_matters: z.string().nullable().optional(),
		facet_mentions: z
			.array(
				z
					.object({
						person_key: z.string(),
						kind_slug: z.string(),
						value: z.string(),
						quote: z.string().nullable().optional(),
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
