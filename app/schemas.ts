// -------------------------------------------------------
// Zod schemas for runtime validation and type inference
// These schemas validate data at runtime and can generate
// TypeScript types. Import from here instead of defining
// schemas scattered across components/tools.
// -------------------------------------------------------

import { z } from "zod"

// Reusable utility schemas
const nullableString = z.string().nullable()

// Contact info schema (shared across person-related schemas)
export const contactInfoSchema = z
	.object({
		emails: z.array(z.string()).optional(),
		phones: z.array(z.string()).optional(),
		addresses: z.array(z.string()).optional(),
		social_profiles: z.record(z.string(), z.string()).optional(),
	})
	.nullable()

// Person detail schema (used by fetch-people-details tool)
export const personDetailSchema = z.object({
	personId: z.string(),
	name: nullableString,
	age: z.number().nullable(),
	gender: nullableString,
	pronouns: nullableString,
	title: nullableString,
	company: nullableString,
	occupation: nullableString,
	role: nullableString,
	segment: nullableString,
	industry: nullableString,
	income: z.number().nullable(),
	location: nullableString,
	timezone: nullableString,
	languages: z.array(z.string()).nullable(),
	education: nullableString,
	lifecycle_stage: nullableString,
	description: nullableString,
	preferences: nullableString,
	image_url: nullableString,
	linkedin_url: nullableString,
	website_url: nullableString,
	contactInfo: contactInfoSchema,
	primary_email: nullableString,
	primary_phone: nullableString,
	// Project-specific data
	projectRole: nullableString,
	interviewCount: z.number().nullable(),
	firstSeenAt: nullableString,
	lastSeenAt: nullableString,
	// Related data
	personas: z
		.array(
			z.object({
				id: nullableString,
				name: nullableString,
				color_hex: nullableString,
				description: nullableString,
				assigned_at: nullableString,
				confidence_score: z.number().nullable(),
			})
		)
		.optional(),
	interviews: z
		.array(
			z.object({
				id: z.string(),
				title: nullableString,
				interview_date: nullableString,
				status: nullableString,
				evidenceCount: z.number().optional(),
			})
		)
		.optional(),
	evidenceCount: z.number().optional(),
	created_at: nullableString,
	updated_at: nullableString,
})

// Evidence detail schema (used by fetch-evidence tool) - further simplified
export const evidenceDetailSchema = z.object({
	id: z.string(),
	projectId: z.string().nullable(),
	interviewId: z.string().nullable(),
	verbatim: z.string(),
	gist: z.string().nullable(),
	contextSummary: z.string().nullable(),
	modality: z.string().nullable(),
	confidence: z.string().nullable(),
	createdAt: z.string().nullable(),
	updatedAt: z.string().nullable(),
	// Simplified related data
	interviewTitle: z.string().nullable(),
	interviewDate: z.string().nullable(),
	interviewStatus: z.string().nullable(),
	personName: z.string().nullable(),
	personRole: z.string().nullable(),
	insightCount: z.number().nullable(),
})

// Project goals schema (used by fetch-project-goals tool)
export const projectGoalsSchema = z.object({
	projectId: z.string(),
	targetOrgs: z.array(z.string()).nullable(),
	targetRoles: z.array(z.string()).nullable(),
	researchGoal: nullableString,
	researchGoalDetails: nullableString,
	decisionQuestions: z.array(z.string()).nullable(),
	assumptions: z.array(z.string()).nullable(),
	unknowns: z.array(z.string()).nullable(),
	customInstructions: nullableString,
	settings: z.record(z.string(), z.unknown()).nullable(),
})

// Personas detail schema (used by fetch-personas tool)
export const personasDetailSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: nullableString,
	colorHex: nullableString,
	primaryGoal: nullableString,
	motivations: z.array(z.string()).nullable(),
	frustrations: z.array(z.string()).nullable(),
	peopleCount: z.number(),
	createdAt: nullableString,
	updatedAt: nullableString,
})

// Theme detail schema (used by fetch-themes tool)
export const themeDetailSchema = z.object({
	id: z.string(),
	name: z.string(),
	statement: nullableString,
	inclusionCriteria: nullableString,
	exclusionCriteria: nullableString,
	synonyms: z.array(z.string()).nullable(),
	antiExamples: z.array(z.string()).nullable(),
	evidenceCount: z.number(),
	createdAt: nullableString,
	updatedAt: nullableString,
})

// Type exports - use these instead of z.infer<typeof schema> everywhere
export type PersonDetail = z.infer<typeof personDetailSchema>
export type EvidenceDetail = z.infer<typeof evidenceDetailSchema>
export type ContactInfo = z.infer<typeof contactInfoSchema>
export type ProjectGoals = z.infer<typeof projectGoalsSchema>
export type ThemeDetail = z.infer<typeof themeDetailSchema>
export type PersonasDetail = z.infer<typeof personasDetailSchema>
