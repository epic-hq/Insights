import { z } from "zod" // Centralized application type definitions

// -------------------------------------------------------
// All UI components should import domain types from this
// file instead of defining duplicates scattered across
// the codebase. This file primarily re-exports the
// Supabase-generated types and provides clear aliases
// for our key domain entities.
// -------------------------------------------------------

import type { SupabaseClient as UntypedSupabaseClient } from "@supabase/supabase-js"
// 1. Core Supabase types
// ----------------------
// These come from `supabase/types.ts`, generated via the
// Supabase CLI. They include generic helper utilities
// `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, etc.
import type { Database as SupabaseDB } from "~/../supabase/types"
import type { PersonaSlice } from "~/components/charts/PersonaDonut"

// Helper generics --------------------------------------------------
// Narrow helpers to the "public" schema for brevity. Extend if you
// ever need other schemas.
export type Database = SupabaseDB
export type SupabaseClient = UntypedSupabaseClient<Database>

export type Tables<TName extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][TName]["Row"]

export type TablesInsert<TName extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][TName]["Insert"]

export type TablesUpdate<TName extends keyof Database["public"]["Tables"]> =
	Database["public"]["Tables"][TName]["Update"]

export type Enums<EName extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][EName]

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
export type Tag = Tables<"tags">
export type Person = Tables<"people">
export type Project = Tables<"projects">
export type InterviewTag = Tables<"interview_tags">
export type InsightTag = Tables<"insight_tags">
export type PeoplePersona = Tables<"people_personas">
export type Comment = Tables<"comments">
export type AccountSettings = Tables<"account_settings">

// 3. Insert / Update helpers (optional)
// ------------------------------------
export type InsightInsert = TablesInsert<"insights">
export type InsightUpdate = TablesUpdate<"insights">
export type InterviewInsert = TablesInsert<"interviews">
export type InterviewUpdate = TablesUpdate<"interviews">
export type OpportunityInsert = TablesInsert<"opportunities">
export type OpportunityUpdate = TablesUpdate<"opportunities">
export type PersonInsert = TablesInsert<"people">
export type PersonUpdate = TablesUpdate<"people">
export type ProjectInsert = TablesInsert<"projects">
export type ProjectUpdate = TablesUpdate<"projects">
export type InterviewTagInsert = TablesInsert<"interview_tags">
export type InterviewTagUpdate = TablesUpdate<"interview_tags">
export type InsightTagInsert = TablesInsert<"insight_tags">
export type InsightTagUpdate = TablesUpdate<"insight_tags">
export type PeoplePersonaInsert = TablesInsert<"people_personas">
export type PeoplePersonaUpdate = TablesUpdate<"people_personas">
export type CommentInsert = TablesInsert<"comments">
export type CommentUpdate = TablesUpdate<"comments">
export type AccountSettingsInsert = TablesInsert<"account_settings">
export type AccountSettingsUpdate = TablesUpdate<"account_settings">

// 4. View-model helpers
// ---------------------
// UI often needs joined or aggregated shapes that aren't
// direct table rows. Define them here so components can
// reuse consistently.

// Kanban UI interfaces
export interface OpportunityItem {
	id: string
	title: string
	owner: string
	priority?: "high" | "medium" | "low"
}

export interface ColumnData {
	title: string
	items: OpportunityItem[]
}

export interface InsightWithEvidence extends Insight {
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
	updated_at?: string | null
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

export type PersonaView = Persona & {
	percentage?: number | null
	count?: number
	color?: string
	slices?: PersonaSlice[]
	href?: string
}

export interface PersonaWithCounts extends Persona {
	interview_count: number
	insight_count: number
}

// Composite view-models ------------------------------------------
export interface InterviewBundle {
	interview: Interview
	insights: Insight[]
	comments: Comment[]
}

export interface PersonaBundle {
	persona: Persona
	people: Person[]
}
// -------------------------------------------------------
// Usage example in a component or loader:
// import { Insight } from "~/app/types"
// const data: Insight[] = await db.from("insights").select()
// -------------------------------------------------------

export const InterviewStatus = z.enum([
	"draft",
	"scheduled",
	"uploaded",
	"transcribed",
	"processing",
	"ready",
	"tagged",
	"archived",
])
export type InterviewStatus = z.infer<typeof InterviewStatus>

// TODO: Double check the types here
export type GetAccount = {
	account_id: string,
	account_role: string,
	is_primary_owner: boolean,
	name: string,
	slug: string,
	personal_account: boolean,
	billing_enabled: boolean,
	billing_status: string,
	created_at: string,
	updated_at: string,
	metadata: Record<string, unknown>
}

export type UUID = string