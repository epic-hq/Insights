import { z } from "zod" // Centralized application type definitions

// -------------------------------------------------------
// All UI components should import domain types from this
// file instead of defining duplicates scattered across
// the codebase. This file primarily re-exports the
// Supabase-generated types and provides clear aliases
// for our key domain entities.
// -------------------------------------------------------

import type { SupabaseClient as UntypedSupabaseClient } from "@supabase/supabase-js"
import type { PersonaSlice } from "~/components/charts/PersonaDonut"
// 1. Core Supabase types
// ----------------------
// These come from `supabase/types.ts`, generated via the
// Supabase CLI. They include generic helper utilities
// `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, etc.
import type { Database as SupabaseDB } from "~/types-db-override" // NOTE: WE ARE USING THE OVERRIDDEN TYPES HERE

// Helper generics --------------------------------------------------
// Narrow helpers to the "public" schema for brevity. Extend if you
// ever need other schemas.
export type Database = SupabaseDB
export type SupabaseClient = UntypedSupabaseClient<Database>

export type Tables<TName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TName]["Row"]

type TablesInsert<TName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TName]["Insert"]

type TablesUpdate<TName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TName]["Update"]

type Enums<EName extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][EName]

// RPC function argument helper
export type RpcArgs<RpcName extends keyof Database["public"]["Functions"]> =
	Database["public"]["Functions"][RpcName]["Args"]

// RPC function return type helper
type RpcReturns<RpcName extends keyof Database["public"]["Functions"]> =
	Database["public"]["Functions"][RpcName]["Returns"]

// Re-export account types

// 2. Domain aliases (Row representations)
// --------------------------------------
// Using the generic `Tables<"table_name">` helper keeps
// the types always in sync with the DB schema. If the
// schema changes and we regenerate Supabase types, these
// aliases automatically stay correct.

export type Insight = Tables<"insights">
export type Interview = Tables<"interviews">
export type Persona = Tables<"personas"> // ensure table exists in DB
export type Opportunity = Tables<"opportunities"> // ensure table exists in DB
export type Organization = Tables<"organizations">
type Tag = Tables<"tags">
export type Person = Tables<"people">
export type Project = Tables<"projects">
export type Project_Section = Tables<"project_sections">
type InterviewTag = Tables<"interview_tags">
type InsightTag = Tables<"insight_tags">
export type InterviewPeople = Tables<"interview_people">
type Comment = Tables<"comments">
export type AccountSettings = Tables<"account_settings">
export type UserSettings = Tables<"user_settings">
export type Evidence = Tables<"evidence">
export type Theme = Tables<"themes">
type Theme_Evidence = Tables<"theme_evidence">
// Newly exposed domain types to replace `any` usage in components
export type Annotation = Tables<"annotations">
type EntityFlag = Tables<"entity_flags">

// 3. Insert / Update helpers (optional)
// ------------------------------------
export type InsightInsert = TablesInsert<"insights">
type InsightUpdate = TablesUpdate<"insights">
export type InterviewInsert = TablesInsert<"interviews">
type InterviewUpdate = TablesUpdate<"interviews">
type OpportunityInsert = TablesInsert<"opportunities">
type OpportunityUpdate = TablesUpdate<"opportunities">
type OrganizationInsert = TablesInsert<"organizations">
type OrganizationUpdate = TablesUpdate<"organizations">
type PersonInsert = TablesInsert<"people">
type PersonUpdate = TablesUpdate<"people">
export type ProjectInsert = TablesInsert<"projects">
export type ProjectUpdate = TablesUpdate<"projects">
export type Project_SectionInsert = TablesInsert<"project_sections">
export type Project_SectionUpdate = TablesUpdate<"project_sections">
type InterviewTagInsert = TablesInsert<"interview_tags">
type InterviewTagUpdate = TablesUpdate<"interview_tags">
type InsightTagInsert = TablesInsert<"insight_tags">
type InsightTagUpdate = TablesUpdate<"insight_tags">
type PeoplePersonaInsert = TablesInsert<"people_personas">
type PeoplePersonaUpdate = TablesUpdate<"people_personas">
export type ProjectPeople = Tables<"project_people">
export type PeopleOrganization = Tables<"people_organizations">
type PeopleOrganizationUpdate = TablesUpdate<"people_organizations">
type CommentInsert = TablesInsert<"comments">
type CommentUpdate = TablesUpdate<"comments">
type AccountSettingsInsert = TablesInsert<"account_settings">
type AccountSettingsUpdate = TablesUpdate<"account_settings">
type UserSettingsInsert = TablesInsert<"user_settings">
type UserSettingsUpdate = TablesUpdate<"user_settings">
type EvidenceInsert = TablesInsert<"evidence">
type EvidenceUpdate = TablesUpdate<"evidence">
type ThemeInsert = TablesInsert<"themes">
type ThemeUpdate = TablesUpdate<"themes">
type Theme_EvidenceInsert = TablesInsert<"theme_evidence">
type Theme_EvidenceUpdate = TablesUpdate<"theme_evidence">
type AnnotationInsert = TablesInsert<"annotations">
type AnnotationUpdate = TablesUpdate<"annotations">
type EntityFlagInsert = TablesInsert<"entity_flags">
type EntityFlagUpdate = TablesUpdate<"entity_flags">

// 4. Extended types for complex queries
// -------------------------------------
// These represent the results of complex Supabase queries with joins/relations
export type InterviewWithPeople = Interview & {
	interview_people: Array<{
		role: string
		people: Person & {
			people_personas: Array<{
				persona_id: string
				personas: Pick<Persona, "id" | "name" | "color_hex">
			}>
		}
	}>
}

// Convenience UI-facing narrows (kept minimal, align with DB rows)
export type UserFlag = Pick<EntityFlag, "flag_type" | "flag_value">

// Comment-like annotations used in some UIs (annotation_type === "comment")
// Note: annotation_type is string in DB; narrow in usage sites if you enforce literal unions elsewhere
export type AnnotationComment = Annotation & { annotation_type: string }

// Questions: shape coming from persisted section meta before normalization
export type QuestionInput = {
	id?: string
	text?: string
	question?: string
	categoryId?: string
	category?: string
	rationale?: string
	scores?: {
		importance?: number
		goalMatch?: number
		novelty?: number
	}
	importance?: number
	goalMatch?: number
	novelty?: number
	status?: "proposed" | "asked" | "answered" | "skipped"
	isSelected?: boolean
	selectedOrder?: number
}

// 4. View-model helpers
// ---------------------
// UI often needs joined or aggregated shapes that aren't
// direct table rows. Define them here so components can
// reuse consistently.

// Kanban UI interfaces
interface OpportunityItem {
	id: string
	title: string
	owner: string
	priority?: "high" | "medium" | "low"
}

interface ColumnData {
	title: string
	items: OpportunityItem[]
}

interface InsightWithEvidence extends Insight {
	evidence_interviews: Interview[]
}

// Example aggregated persona metrics
// UI-friendly extensions -----------------------------------------
export interface OpportunityView extends Opportunity {
	owner?: string | null
	status?: string | null
	impact?: number | null
	effort?: number | null
	description?: string | null
	name?: string | null
	confidence?: number | null
	priority?: string | null
	tags?: string[] | null
	insights?: string[] | null
	assignee?: string | null
	due_date?: string | null
	comments?: CommentView[]
}

// --------------------------------------
// Insight UI view type
// --------------------------------------

// DB-aligned insight view (snake_case + nested relations)
export interface InsightView extends Insight {
	// convenience aliases expected by existing UI (snake_case)
	title?: string | null // maps to name
	impact_score?: number | null // maps to impact
	content?: string | null // maps to details
	tags?: Array<{ id: string; tag: string }> // flattened tags array
	id: string

	// Relations
	insight_tags?: Array<{ tags: Tag }>
	interviews?: Array<{
		id: string
		title: string | null
		interview_date: string | null
	}>
	comments?: CommentView[]
}

// Rich comment shape used in UI
export interface CommentView extends Comment {
	author?: string
	timestamp?: string
	text?: string
}

type PersonaView = Persona & {
	percentage?: number | null
	count?: number
	color?: string
	slices?: PersonaSlice[]
	href?: string
}

interface PersonaWithCounts extends Persona {
	interview_count: number
	insight_count: number
}

// Composite view-models ------------------------------------------
interface InterviewBundle {
	interview: Interview
	insights: Insight[]
	comments: Comment[]
}

interface PersonaBundle {
	persona: Persona
	people: Person[]
}
// -------------------------------------------------------
// Usage example in a component or loader:
// import { Insight } from "~/app/types"
// const data: Insight[] = await db.from("insights").select()
// -------------------------------------------------------

const InterviewStatus = z.enum([
	"draft",
	"scheduled",
	"uploaded",
	"transcribed",
	"processing",
	"ready",
	"tagged",
	"archived",
])
type InterviewStatus = z.infer<typeof InterviewStatus>

// TODO: Double check the types here
export type GetAccount = {
	account_id: string
	account_role: string
	is_primary_owner: boolean
	name: string
	slug: string
	personal_account: boolean
	billing_enabled: boolean
	billing_status: string
	created_at: string
	updated_at: string
	metadata: Record<string, unknown>
}

export type UUID = string
