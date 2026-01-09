import slugify from "@sindresorhus/slugify"
import { z } from "zod"

export const ResearchLinkQuestionSchema = z.object({
	id: z.string().min(1, "Question id is required"),
	prompt: z.string().min(1, "Question text is required"),
	required: z.boolean().default(false),
	type: z.enum(["auto", "short_text", "long_text", "single_select", "multi_select"]).default("auto"),
	placeholder: z.string().optional().nullable(),
	helperText: z.string().optional().nullable(),
	options: z.array(z.string()).optional().nullable(),
})

export type ResearchLinkQuestion = z.infer<typeof ResearchLinkQuestionSchema>

export function createEmptyQuestion(): ResearchLinkQuestion {
	const id =
		typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
	return {
		id,
		prompt: "",
		required: false,
		type: "auto",
		placeholder: null,
		helperText: null,
		options: null,
	}
}

const QuestionsJsonSchema = z
	.string({ required_error: "Questions payload is required" })
	.transform((value, ctx) => {
		try {
			const parsed = JSON.parse(value ?? "[]")
			return parsed
		} catch (error) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Invalid questions payload",
			})
			return z.NEVER
		}
	})
	.pipe(z.array(ResearchLinkQuestionSchema).min(1, "Add at least one question"))

const textField = z
	.string()
	.optional()
	.transform((value) => {
		const trimmed = value?.trim() ?? ""
		return trimmed.length > 0 ? trimmed : null
	})

const booleanFlag = z
	.union([z.string(), z.boolean(), z.undefined(), z.null()])
	.transform((value) => value === true || value === "true" || value === "on")

export const ResearchLinkPayloadSchema = z.object({
	name: z
		.string({ required_error: "Name is required" })
		.transform((value) => value.trim())
		.refine((value) => value.length > 0, { message: "Name is required" }),
	slug: z
		.string({ required_error: "Slug is required" })
		.transform((value) => slugify(value.trim(), { lowercase: true }))
		.refine((value) => value.length > 0, { message: "Slug is required" }),
	description: textField,
	heroTitle: textField,
	heroSubtitle: textField,
	heroCtaLabel: textField,
	heroCtaHelper: textField,
	calendarUrl: z
		.string()
		.optional()
		.transform((value, ctx) => {
			const trimmed = value?.trim() ?? ""
			if (trimmed.length === 0) return null
			try {
				// eslint-disable-next-line no-new
				new URL(trimmed)
				return trimmed
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Enter a valid calendar URL",
				})
				return z.NEVER
			}
		}),
	redirectUrl: z
		.string()
		.optional()
		.transform((value, ctx) => {
			const trimmed = value?.trim() ?? ""
			if (trimmed.length === 0) return null
			try {
				// eslint-disable-next-line no-new
				new URL(trimmed)
				return trimmed
			} catch {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "Enter a valid redirect URL",
				})
				return z.NEVER
			}
		}),
	allowChat: booleanFlag,
	allowVoice: booleanFlag,
	allowVideo: booleanFlag,
	defaultResponseMode: z
		.union([z.literal("form"), z.literal("chat"), z.literal("voice"), z.string().optional(), z.null()])
		.transform((value) => {
			if (value === "chat") return "chat"
			if (value === "voice") return "voice"
			return "form"
		}),
	isLive: booleanFlag,
	questions: QuestionsJsonSchema,
})

export type ResearchLinkPayload = z.infer<typeof ResearchLinkPayloadSchema>

export const ResearchLinkResponseStartSchema = z.object({
	email: z.string({ required_error: "Email is required" }).email("Enter a valid email"),
	responseId: z.string().uuid().optional().nullable(),
	responseMode: z.enum(["form", "chat"]).optional(),
})

export const ResearchLinkResponseSaveSchema = z.object({
	responseId: z.string().uuid({ message: "Response id is required" }),
	responses: z
		.record(z.union([z.string(), z.array(z.string()), z.boolean(), z.null()]))
		.optional()
		.default({}),
	completed: z.boolean().optional(),
})

export type ResearchLinkResponsePayload = z.infer<typeof ResearchLinkResponseSaveSchema>
