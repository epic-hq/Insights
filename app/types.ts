import { z } from "zod" // Centralized application type definitions
// -------------------------------------------------------
// All UI components should import domain types from this
// file instead of defining duplicates scattered across
// the codebase. This file primarily re-exports the
// Supabase-generated types and provides clear aliases
// for our key domain entities.
// -------------------------------------------------------

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
export type Theme = Tables<"themes">
export type Tag = Tables<"tags">

// 3. Insert / Update helpers (optional)
// ------------------------------------
export type InsightInsert = TablesInsert<"insights">
export type InsightUpdate = TablesUpdate<"insights">
export type OpportunityInsert = TablesInsert<"opportunities">
export type OpportunityUpdate = TablesUpdate<"opportunities">

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
}

// --------------------------------------
// Insight UI view type
// --------------------------------------
export interface InsightView {
	id: string
	name?: string // primary short title
	tag?: string // deprecated old name
	title?: string
	category?: string
	journeyStage?: string
	impact?: number | string | null
	novelty?: number | null
	jtbd?: string | null
	underlyingMotivation?: string | null
	pain?: string | null
	desiredOutcome?: string | null
	description?: string | null
	evidence?: string | null
	opportunityIdeas?: string[] | null
	confidence?: number | string | null
	createdAt?: string | null
	relatedTags?: string[]
	contradictions?: string | null
	interview_id?: string | null
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
