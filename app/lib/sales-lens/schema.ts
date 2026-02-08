import { z } from "zod";

export const salesFrameworkEnum = z.enum(["BANT_GPCT", "SPICED", "MEDDIC", "MAP"]);

const optionalDateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.optional()
	.nullable();

const evidencePointerSchema = z.object({
	evidenceId: z.string().uuid(),
	startMs: z.number().int().nonnegative().optional().nullable(),
	endMs: z.number().int().nonnegative().optional().nullable(),
	transcriptSnippet: z.string().optional().nullable(),
});

const slotHygieneSchema = z.object({
	code: z.string(),
	severity: z.enum(["info", "warning", "critical"]),
	message: z.string().optional().nullable(),
	slot: z.string().optional().nullable(),
});

const salesFrameworkSlotSchema = z.object({
	slot: z.string(),
	label: z.string().optional().nullable(),
	summary: z.string().optional().nullable(),
	textValue: z.string().optional().nullable(),
	numericValue: z.number().nullable().optional(),
	dateValue: optionalDateString,
	status: z.string().optional().nullable(),
	confidence: z.number().min(0).max(1).nullable().optional(),
	ownerPersonId: z.string().uuid().optional().nullable(),
	ownerPersonKey: z.string().optional().nullable(),
	relatedPersonIds: z.array(z.string().uuid()).default([]),
	relatedOrganizationIds: z.array(z.string().uuid()).default([]),
	evidence: z.array(evidencePointerSchema).default([]),
	hygiene: z.array(slotHygieneSchema).default([]),
});

const stakeholderLabelEnum = z.enum(["economic_buyer", "influencer", "champion", "blocker", "decision_maker"]);

const stakeholderSchema = z
	.object({
		personId: z.string().uuid().optional().nullable(),
		personKey: z.string().optional().nullable(),
		candidatePersonKey: z.string().optional().nullable(),
		displayName: z.string(),
		role: z.string().optional().nullable(),
		influence: z.enum(["low", "medium", "high"]).default("low"),
		labels: z.array(stakeholderLabelEnum).default([]),
		organizationId: z.string().uuid().optional().nullable(),
		email: z.string().email().optional().nullable(),
		confidence: z.number().min(0).max(1).optional().nullable(),
		evidence: z.array(evidencePointerSchema).default([]),
	})
	.refine((value) => Boolean(value.personId || value.candidatePersonKey), {
		message: "Stakeholder must include a personId or candidatePersonKey",
		path: ["personId"],
	});

const objectionSchema = z.object({
	type: z.enum(["price", "timing", "integration", "security", "authority", "other"]),
	status: z.enum(["raised", "resolved", "open"]),
	confidence: z.number().min(0).max(1),
	evidence: z.array(evidencePointerSchema).default([]),
});

const nextStepSchema = z.object({
	description: z.string(),
	ownerPersonId: z.string().uuid().optional().nullable(),
	ownerPersonKey: z.string().optional().nullable(),
	dueDate: optionalDateString,
	confidence: z.number().min(0).max(1),
	evidence: z.array(evidencePointerSchema).default([]),
});

const mapMilestoneSchema = z.object({
	label: z.string(),
	ownerPersonId: z.string().uuid().optional().nullable(),
	ownerPersonKey: z.string().optional().nullable(),
	dueDate: optionalDateString,
	status: z.enum(["planned", "in_progress", "done"]).default("planned"),
	evidence: z.array(evidencePointerSchema).default([]),
});

const salesFrameworkSchema = z.object({
	name: salesFrameworkEnum,
	hygiene: z.array(slotHygieneSchema).default([]),
	slots: z.array(salesFrameworkSlotSchema).default([]),
});

export const salesConversationExtractionSchema = z.object({
	meetingId: z.string().uuid(),
	projectId: z.string().uuid(),
	accountId: z.string().uuid(),
	opportunityId: z.string().uuid().optional().nullable(),
	attendeePersonIds: z.array(z.string().uuid()).default([]),
	attendeePersonKeys: z.array(z.string()).default([]),
	frameworks: z.array(salesFrameworkSchema),
	entities: z
		.object({
			stakeholders: z.array(stakeholderSchema).default([]),
			objections: z.array(objectionSchema).default([]),
		})
		.default({ stakeholders: [], objections: [] }),
	nextStep: nextStepSchema,
	map: z
		.object({
			milestones: z.array(mapMilestoneSchema).default([]),
		})
		.optional(),
});

export type SalesConversationExtraction = z.infer<typeof salesConversationExtractionSchema>;
export type SalesFrameworkSlot = z.infer<typeof salesFrameworkSlotSchema>;
export type SalesFrameworkPayload = z.infer<typeof salesFrameworkSchema>;
