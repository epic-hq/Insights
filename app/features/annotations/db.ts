import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"
import type {
	AISuggestionContent,
	AnnotationContentJsonb,
	OpportunityAdviceContent,
} from "./types"

// Database types for annotations system
type DB = Database["public"]
export type Annotation = DB["Tables"]["annotations"]["Row"]
export type AnnotationInsert = DB["Tables"]["annotations"]["Insert"]
type AnnotationUpdate = DB["Tables"]["annotations"]["Update"]

// Entity types that can have annotations
export type EntityType = "insight" | "persona" | "opportunity" | "interview" | "person" | "project"
export type AnnotationType = "comment" | "ai_suggestion" | "flag" | "note" | "todo" | "reaction"
export type FlagType = "hidden" | "archived" | "starred" | "priority"

export type AnnotationMetadata = Record<string, unknown>

// Batched variant: fetch vote counts for multiple entities in one round-trip
export async function getVoteCountsForEntities({
	supabase,
	projectId,
	entityType,
	entityIds,
	userId,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
	entityType: EntityType
	entityIds: string[]
	userId?: string
}) {
	try {
		if (!entityIds.length) return { data: {}, error: null }

		// Fetch all votes for these entities in one query
		const { data: rows, error } = await supabase
			.from("votes")
			.select("entity_id, vote_value, user_id")
			.eq("project_id", projectId)
			.eq("entity_type", entityType)
			.in("entity_id", entityIds)

		if (error) {
			consola.error("Error fetching batched votes:", error)
			return { data: null, error }
		}

		// Reduce into per-entity counts
		const byId = new Map<string, { up: number; down: number; user: number }>()
		for (const id of entityIds) byId.set(id, { up: 0, down: 0, user: 0 })

		for (const row of rows || []) {
			const bucket = byId.get(row.entity_id)
			if (!bucket) continue
			if (row.vote_value === 1) bucket.up += 1
			else if (row.vote_value === -1) bucket.down += 1
			if (userId && row.user_id === userId) bucket.user = row.vote_value as 1 | -1
		}

		const result: Record<string, VoteCounts> = {}
		for (const [id, { up, down, user }] of byId.entries()) {
			result[id] = {
				upvotes: up,
				downvotes: down,
				total_votes: up + down,
				user_vote: user,
			}
		}

		return { data: result, error: null }
	} catch (error) {
		consola.error("Exception in getVoteCountsForEntities:", error)
		return { data: null, error }
	}
}

export interface VoteCounts {
	upvotes: number
	downvotes: number
	total_votes: number
	user_vote: number // -1, 0, or 1
}

export interface UserFlags {
	hidden: boolean
	archived: boolean
	starred: boolean
	priority: boolean
}

// =============================================================================
// ANNOTATION FUNCTIONS
// =============================================================================

export async function getAnnotationsForEntity({
	supabase,
	accountId,
	projectId,
	entityType,
	entityId,
	annotationType,
	includeThreads = true,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	entityType: EntityType
	entityId: string
	annotationType?: AnnotationType
	includeThreads?: boolean
}) {
	try {
		let query = supabase
			.from("annotations")
			.select("*")
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.eq("entity_type", entityType)
			.eq("entity_id", entityId)
			.eq("status", "active")
			.order("created_at", { ascending: true })

		if (annotationType) {
			query = query.eq("annotation_type", annotationType)
		}

		if (!includeThreads) {
			query = query.is("parent_annotation_id", null)
		}

		const { data, error } = await query

		if (error) {
			consola.error("Error fetching annotations:", error)
			return { data: null, error }
		}

		return { data: data || [], error: null }
	} catch (error) {
		consola.error("Exception in getAnnotationsForEntity:", error)
		return { data: null, error }
	}
}

export async function createAnnotation({
	supabase,
	accountId,
	projectId,
	entityType,
	entityId,
	annotationType,
	content,
	metadata,
	parentAnnotationId,
	threadRootId,
	createdByAi = false,
	aiModel,
	createdByUserId,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	entityType: EntityType
	entityId: string
	annotationType: AnnotationType
	content?: string
	metadata?: AnnotationMetadata
	parentAnnotationId?: string
	threadRootId?: string
	createdByAi?: boolean
	aiModel?: string
	createdByUserId?: string
}) {
	try {
		const insertData: AnnotationInsert = {
			account_id: accountId,
			project_id: projectId,
			entity_type: entityType,
			entity_id: entityId,
			annotation_type: annotationType,
			content,
			metadata: metadata ?? null,
			parent_annotation_id: parentAnnotationId,
			thread_root_id: threadRootId,
			created_by_ai: createdByAi,
			ai_model: aiModel,
			created_by_user_id: typeof createdByUserId !== "undefined" ? createdByUserId : null,
		}

		const { data, error } = await supabase.from("annotations").insert(insertData).select().single()

		if (error) {
			consola.error("Error creating annotation:", error)
			return { data: null, error }
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in createAnnotation:", error)
		return { data: null, error }
	}
}

export async function updateAnnotation({
	supabase,
	annotationId,
	updates,
}: {
	supabase: SupabaseClient<Database>
	annotationId: string
	updates: AnnotationUpdate
}) {
	try {
		const { data, error } = await supabase
			.from("annotations")
			.update({ ...updates, updated_at: new Date().toISOString() })
			.eq("id", annotationId)
			.select()
			.single()

		if (error) {
			consola.error("Error updating annotation:", error)
			return { data: null, error }
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in updateAnnotation:", error)
		return { data: null, error }
	}
}

export async function deleteAnnotation({
	supabase,
	annotationId,
}: {
	supabase: SupabaseClient<Database>
	annotationId: string
}) {
	try {
		const { error } = await supabase.from("annotations").delete().eq("id", annotationId)

		if (error) {
			consola.error("Error deleting annotation:", error)
			return { error }
		}

		return { error: null }
	} catch (error) {
		consola.error("Exception in deleteAnnotation:", error)
		return { error }
	}
}

// =============================================================================
// VOTING FUNCTIONS
// =============================================================================

export async function getVoteCountsForEntity({
	supabase,
	projectId,
	entityType,
	entityId,
	userId,
}: {
	supabase: SupabaseClient<Database>
	projectId: string
	entityType: EntityType
	entityId: string
	userId?: string
}) {
	try {
		// Get vote counts using helper function
		const { data: voteCounts, error: countsError } = await supabase
			.rpc("get_vote_counts", {
				p_entity_type: entityType,
				p_entity_id: entityId,
				p_project_id: projectId,
			})
			.single()

		if (countsError) {
			consola.error("Error fetching vote counts:", countsError)
			return { data: null, error: countsError }
		}

		// Get user's vote if userId provided
		let userVote = 0
		if (userId) {
			const { data: userVoteData, error: userVoteError } = await supabase
				.rpc("get_user_vote", {
					p_entity_type: entityType,
					p_entity_id: entityId,
					p_project_id: projectId,
				})
				.single()

			if (userVoteError) {
				consola.error("Error fetching user vote:", userVoteError)
			} else {
				userVote = userVoteData || 0
			}
		}

		const result: VoteCounts = {
			upvotes: Number(voteCounts.upvotes) || 0,
			downvotes: Number(voteCounts.downvotes) || 0,
			total_votes: Number(voteCounts.total_votes) || 0,
			user_vote: userVote,
		}

		return { data: result, error: null }
	} catch (error) {
		consola.error("Exception in getVoteCountsForEntity:", error)
		return { data: null, error }
	}
}

export async function upsertVote({
	supabase,
	accountId,
	projectId,
	entityType,
	entityId,
	userId,
	voteValue,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	entityType: EntityType
	entityId: string
	userId: string
	voteValue: 1 | -1 // 1 for upvote, -1 for downvote
}) {
	try {
		const { data, error } = await supabase
			.from("votes")
			.upsert({
				account_id: accountId,
				project_id: projectId,
				entity_type: entityType,
				entity_id: entityId,
				user_id: userId,
				vote_value: voteValue,
				updated_at: new Date().toISOString(),
			})
			.select()
			.single()

		if (error) {
			consola.error("Error upserting vote:", error)
			return { data: null, error }
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in upsertVote:", error)
		return { data: null, error }
	}
}

export async function removeVote({
	supabase,
	entityType,
	entityId,
	userId,
}: {
	supabase: SupabaseClient<Database>
	entityType: EntityType
	entityId: string
	userId: string
}) {
	try {
		const { error } = await supabase
			.from("votes")
			.delete()
			.eq("entity_type", entityType)
			.eq("entity_id", entityId)
			.eq("user_id", userId)

		if (error) {
			consola.error("Error removing vote:", error)
			return { error }
		}

		return { error: null }
	} catch (error) {
		consola.error("Exception in removeVote:", error)
		return { error }
	}
}

// =============================================================================
// ENTITY FLAGS FUNCTIONS
// =============================================================================

export async function getUserFlagsForEntity({
	supabase,
	entityType,
	entityId,
	projectId,
}: {
	supabase: SupabaseClient<Database>
	entityType: EntityType
	entityId: string
	projectId: string
}) {
	try {
		const { data, error } = await supabase.rpc("get_user_flags", {
			p_entity_type: entityType,
			p_entity_id: entityId,
			p_project_id: projectId,
		})

		if (error) {
			consola.error("Error fetching user flags:", error)
			return { data: null, error }
		}

		// Convert array to object for easier access
		const flags: UserFlags = {
			hidden: false,
			archived: false,
			starred: false,
			priority: false,
		}

		if (Array.isArray(data)) {
			const casted = data as Array<{ flag_type?: string; flag_value?: unknown }>
			for (const flag of casted) {
				if (!flag.flag_type || !(flag.flag_type in flags)) continue
				const key = flag.flag_type as keyof UserFlags
				flags[key] = Boolean(flag.flag_value)
			}
		}

		return { data: flags, error: null }
	} catch (error) {
		consola.error("Exception in getUserFlagsForEntity:", error)
		return { data: null, error }
	}
}

export async function setEntityFlag({
	supabase,
	accountId,
	projectId,
	entityType,
	entityId,
	userId,
	flagType,
	flagValue,
	metadata,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	entityType: EntityType
	entityId: string
	userId: string
	flagType: FlagType
	flagValue: boolean
	metadata?: AnnotationMetadata
}) {
	try {
		const { data, error } = await supabase
			.from("entity_flags")
			.upsert({
				account_id: accountId,
				project_id: projectId,
				entity_type: entityType,
				entity_id: entityId,
				user_id: userId,
				flag_type: flagType,
				flag_value: flagValue,
				metadata: metadata ?? null,
				updated_at: new Date().toISOString(),
			})
			.select()
			.single()

		if (error) {
			consola.error("Error setting entity flag:", error)
			return { data: null, error }
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in setEntityFlag:", error)
		return { data: null, error }
	}
}

// =============================================================================
// TYPED AI SUGGESTION FUNCTIONS
// =============================================================================

/**
 * Create an AI suggestion annotation with typed content stored in content_jsonb
 * This replaces the old pattern of JSON.stringify -> content (text field)
 */
export async function createAISuggestion({
	supabase,
	accountId,
	projectId,
	entityType,
	entityId,
	suggestionContent,
	aiModel,
	createdByUserId,
	supersedesAnnotationId,
	metadata,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	entityType: EntityType
	entityId: string
	suggestionContent: AISuggestionContent
	aiModel: string
	createdByUserId?: string
	supersedesAnnotationId?: string
	metadata?: AnnotationMetadata
}) {
	try {
		// Add metadata to the suggestion content
		const enrichedContent: AISuggestionContent = {
			...suggestionContent,
			version: suggestionContent.version || 1,
			generated_at: suggestionContent.generated_at || new Date().toISOString(),
			supersedes_annotation_id: supersedesAnnotationId,
		}

		const insertData: AnnotationInsert = {
			account_id: accountId,
			project_id: projectId,
			entity_type: entityType,
			entity_id: entityId,
			annotation_type: "ai_suggestion",
			content: null, // Use content_jsonb for AI suggestions
			content_jsonb: enrichedContent as any,
			metadata: {
				...metadata,
				suggestion_type: suggestionContent.suggestion_type,
			},
			created_by_ai: true,
			ai_model: aiModel,
			created_by_user_id: createdByUserId || null, // Track which user triggered the AI generation
		}

		const { data, error } = await supabase.from("annotations").insert(insertData).select().single()

		if (error) {
			consola.error("Error creating AI suggestion:", error)
			return { data: null, error }
		}

		// If this supersedes a previous annotation, mark the old one as archived
		if (supersedesAnnotationId) {
			await supabase
				.from("annotations")
				.update({ status: "archived" })
				.eq("id", supersedesAnnotationId)
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in createAISuggestion:", error)
		return { data: null, error }
	}
}

/**
 * Create an opportunity advice AI suggestion
 * Convenience wrapper for the most common use case
 */
export async function createOpportunityAdvice({
	supabase,
	accountId,
	projectId,
	opportunityId,
	statusAssessment,
	recommendations,
	risks,
	confidence,
	aiModel,
	createdByUserId,
	context,
}: {
	supabase: SupabaseClient<Database>
	accountId: string
	projectId: string
	opportunityId: string
	statusAssessment: string
	recommendations: string[]
	risks: string[]
	confidence: "high" | "medium" | "low"
	aiModel: string
	createdByUserId?: string
	context?: {
		stakeholder_count?: number
		next_steps_count?: number
		interviews_analyzed?: number
	}
}) {
	const content: OpportunityAdviceContent = {
		suggestion_type: "opportunity_advice",
		version: 1,
		model: aiModel,
		generated_at: new Date().toISOString(),
		status_assessment: statusAssessment,
		recommendations,
		risks,
		confidence,
		...context,
	}

	return createAISuggestion({
		supabase,
		accountId,
		projectId,
		entityType: "opportunity",
		entityId: opportunityId,
		suggestionContent: content,
		aiModel,
		createdByUserId,
	})
}

/**
 * Get the latest AI suggestion for an entity
 * Returns the most recent active suggestion
 */
export async function getLatestAISuggestion({
	supabase,
	entityType,
	entityId,
	suggestionType,
}: {
	supabase: SupabaseClient<Database>
	entityType: EntityType
	entityId: string
	suggestionType?: string
}) {
	try {
		let query = supabase
			.from("annotations")
			.select("*")
			.eq("entity_type", entityType)
			.eq("entity_id", entityId)
			.eq("annotation_type", "ai_suggestion")
			.eq("status", "active")
			.order("created_at", { ascending: false })
			.limit(1)

		if (suggestionType) {
			query = query.eq("metadata->>suggestion_type", suggestionType)
		}

		const { data, error } = await query.single()

		if (error) {
			// No data found is not an error in this case
			if (error.code === "PGRST116") {
				return { data: null, error: null }
			}
			consola.error("Error fetching latest AI suggestion:", error)
			return { data: null, error }
		}

		return { data, error: null }
	} catch (error) {
		consola.error("Exception in getLatestAISuggestion:", error)
		return { data: null, error }
	}
}

/**
 * Get all AI suggestion versions for an entity (including archived)
 * Useful for showing history/changes over time
 */
export async function getAISuggestionHistory({
	supabase,
	entityType,
	entityId,
	suggestionType,
}: {
	supabase: SupabaseClient<Database>
	entityType: EntityType
	entityId: string
	suggestionType?: string
}) {
	try {
		let query = supabase
			.from("annotations")
			.select("*")
			.eq("entity_type", entityType)
			.eq("entity_id", entityId)
			.eq("annotation_type", "ai_suggestion")
			.order("created_at", { ascending: false })

		if (suggestionType) {
			query = query.eq("metadata->>suggestion_type", suggestionType)
		}

		const { data, error } = await query

		if (error) {
			consola.error("Error fetching AI suggestion history:", error)
			return { data: null, error }
		}

		return { data: data || [], error: null }
	} catch (error) {
		consola.error("Exception in getAISuggestionHistory:", error)
		return { data: null, error }
	}
}
