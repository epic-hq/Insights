/**
 * Helper functions for managing junction table relationships
 * Provides a clean API for working with normalized many-to-many data
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "~/../../supabase/types"

type DatabaseClient = SupabaseClient<Database>

// Type definitions for junction table operations
export interface InsightTagsSync {
	insightId: string
	tags: string[]
	accountId: string
}

export interface OpportunityInsightsSync {
	opportunityId: string
	insightIds: string[]
	weights?: Record<string, number> // Optional weights for each insight
}

export interface PersonaInsightsLink {
	personaId: string
	insightId: string
	relevanceScore?: number
}

export interface ProjectPeopleStats {
	projectId: string
	personId: string
	role?: string
}

/**
 * Insight-Tags Junction Table Helpers
 */
export class InsightTagsHelper {
	constructor(private db: DatabaseClient) {}

	/**
	 * Sync tags for an insight - replaces all existing tags
	 */
	async syncTags({ insightId, tags, accountId }: InsightTagsSync) {
		const { error: deleteError } = await this.db.from("insight_tags").delete().eq("insight_id", insightId)

		if (deleteError) throw deleteError

		if (tags.length === 0) return { data: [], error: null }

		const tagRecords = tags.map((tag) => ({
			insight_id: insightId,
			tag,
			account_id: accountId,
			created_at: new Date().toISOString(),
		}))

		const { data, error } = await this.db.from("insight_tags").insert(tagRecords).select()

		return { data, error }
	}

	/**
	 * Add tags to an insight (without removing existing ones)
	 */
	async addTags({ insightId, tags, accountId }: InsightTagsSync) {
		if (tags.length === 0) return { data: [], error: null }

		const tagRecords = tags.map((tag) => ({
			insight_id: insightId,
			tag,
			account_id: accountId,
			created_at: new Date().toISOString(),
		}))

		const { data, error } = await this.db
			.from("insight_tags")
			.upsert(tagRecords, {
				onConflict: "insight_id,tag,account_id",
				ignoreDuplicates: true,
			})
			.select()

		return { data, error }
	}

	/**
	 * Remove specific tags from an insight
	 */
	async removeTags({ insightId, tags }: { insightId: string; tags: string[] }) {
		const { data, error } = await this.db
			.from("insight_tags")
			.delete()
			.eq("insight_id", insightId)
			.in("tag", tags)
			.select()

		return { data, error }
	}

	/**
	 * Get all tags for an insight
	 */
	async getTagsForInsight(insightId: string) {
		const { data, error } = await this.db.from("insight_tags").select("tag").eq("insight_id", insightId).order("tag")

		return {
			data: data?.map((row) => row.tag) || [],
			error,
		}
	}

	/**
	 * Get all insights for a tag
	 */
	async getInsightsForTag(tag: string, accountId: string) {
		const { data, error } = await this.db
			.from("insight_tags")
			.select(`
        insight_id,
        themes!inner(
          id,
          name,
          category,
          created_at
        )
      `)
			.eq("tag", tag)
			.eq("account_id", accountId)

		return { data, error }
	}
}

/**
 * Interview-Tags Junction Table Helpers
 */
export class InterviewTagsHelper {
	constructor(private db: DatabaseClient) {}

	/**
	 * Sync tags for an interview
	 */
	async syncTags({ interviewId, tags, accountId }: { interviewId: string; tags: string[]; accountId: string }) {
		const { error: deleteError } = await this.db.from("interview_tags").delete().eq("interview_id", interviewId)

		if (deleteError) throw deleteError

		if (tags.length === 0) return { data: [], error: null }

		const tagRecords = tags.map((tag) => ({
			interview_id: interviewId,
			tag,
			account_id: accountId,
			created_at: new Date().toISOString(),
		}))

		const { data, error } = await this.db.from("interview_tags").insert(tagRecords).select()

		return { data, error }
	}

	/**
	 * Get all tags for an interview
	 */
	async getTagsForInterview(interviewId: string) {
		const { data, error } = await this.db
			.from("interview_tags")
			.select("tag")
			.eq("interview_id", interviewId)
			.order("tag")

		return {
			data: data?.map((row) => row.tag) || [],
			error,
		}
	}
}

/**
 * Opportunity-Insights Junction Table Helpers
 */
export class OpportunityInsightsHelper {
	constructor(private db: DatabaseClient) {}

	/**
	 * Sync insights for an opportunity - replaces all existing links
	 */
	async syncInsights({ opportunityId, insightIds, weights = {} }: OpportunityInsightsSync) {
		const { error: deleteError } = await this.db
			.from("opportunity_insights")
			.delete()
			.eq("opportunity_id", opportunityId)

		if (deleteError) throw deleteError

		if (insightIds.length === 0) return { data: [], error: null }

		const insightRecords = insightIds.map((insightId) => ({
			opportunity_id: opportunityId,
			insight_id: insightId,
			weight: weights[insightId] || 1.0,
			created_at: new Date().toISOString(),
		}))

		const { data, error } = await this.db.from("opportunity_insights").insert(insightRecords).select()

		return { data, error }
	}

	/**
	 * Add insights to an opportunity (without removing existing ones)
	 */
	async addInsights({ opportunityId, insightIds, weights = {} }: OpportunityInsightsSync) {
		if (insightIds.length === 0) return { data: [], error: null }

		const insightRecords = insightIds.map((insightId) => ({
			opportunity_id: opportunityId,
			insight_id: insightId,
			weight: weights[insightId] || 1.0,
			created_at: new Date().toISOString(),
		}))

		const { data, error } = await this.db
			.from("opportunity_insights")
			.upsert(insightRecords, {
				onConflict: "opportunity_id,insight_id",
				ignoreDuplicates: true,
			})
			.select()

		return { data, error }
	}

	/**
	 * Get all insights for an opportunity with weights
	 */
	async getInsightsForOpportunity(opportunityId: string) {
		const { data, error } = await this.db
			.from("opportunity_insights")
			.select(`
        insight_id,
        weight,
        themes!inner(
          id,
          name,
          category,
          impact,
          novelty,
          created_at
        )
      `)
			.eq("opportunity_id", opportunityId)
			.order("weight", { ascending: false })

		return { data, error }
	}

	/**
	 * Get all opportunities for an insight
	 */
	async getOpportunitiesForInsight(insightId: string) {
		const { data, error } = await this.db
			.from("opportunity_insights")
			.select(`
        opportunity_id,
        weight,
        opportunities!inner(
          id,
          title,
          kanban_status,
          created_at
        )
      `)
			.eq("insight_id", insightId)
			.order("weight", { ascending: false })

		return { data, error }
	}
}

/**
 * Project-People Junction Table Helpers
 */
export class ProjectPeopleHelper {
	constructor(private db: DatabaseClient) {}

	/**
	 * Update project-people stats (usually called automatically via triggers)
	 */
	async updateStats({ projectId, personId, role }: ProjectPeopleStats) {
		// Get interview stats for this person in this project
		const { data: interviewStats } = await this.db
			.from("interviews")
			.select(`
        id,
        interview_date,
        interview_people!inner(person_id)
      `)
			.eq("project_id", projectId)
			.eq("interview_people.person_id", personId)

		const interviewCount = interviewStats?.length || 0
		const dates = interviewStats?.map((i) => i.interview_date).filter(Boolean) || []
		const firstSeen = dates.length > 0 ? Math.min(...dates.map((d) => new Date(d!).getTime())) : Date.now()
		const lastSeen = dates.length > 0 ? Math.max(...dates.map((d) => new Date(d!).getTime())) : Date.now()

		const { data, error } = await this.db
			.from("project_people")
			.upsert(
				{
					project_id: projectId,
					person_id: personId,
					role,
					interview_count: interviewCount,
					first_seen_at: new Date(firstSeen).toISOString(),
					last_seen_at: new Date(lastSeen).toISOString(),
					updated_at: new Date().toISOString(),
				},
				{
					onConflict: "project_id,person_id",
				}
			)
			.select()

		return { data, error }
	}

	/**
	 * Get all people for a project with stats
	 */
	async getPeopleForProject(projectId: string) {
		const { data, error } = await this.db
			.from("project_people")
			.select(`
        person_id,
        role,
        interview_count,
        first_seen_at,
        last_seen_at,
        people!inner(
          id,
          name,
          persona,
          segment,
          occupation
        )
      `)
			.eq("project_id", projectId)
			.order("interview_count", { ascending: false })

		return { data, error }
	}

	/**
	 * Get all projects for a person with stats
	 */
	async getProjectsForPerson(personId: string) {
		const { data, error } = await this.db
			.from("project_people")
			.select(`
        project_id,
        role,
        interview_count,
        first_seen_at,
        last_seen_at,
        projects!inner(
          id,
          title,
          description,
          status,
          created_at
        )
      `)
			.eq("person_id", personId)
			.order("last_seen_at", { ascending: false })

		return { data, error }
	}
}

/**
 * Persona-Insights Junction Table Helpers
 */
export class PersonaInsightsHelper {
	constructor(private db: DatabaseClient) {}

	/**
	 * Link an insight to a persona with relevance score
	 */
	async linkInsightToPersona({ personaId, insightId, relevanceScore = 1.0 }: PersonaInsightsLink) {
		const { data, error } = await this.db
			.from("persona_insights")
			.upsert(
				{
					persona_id: personaId,
					insight_id: insightId,
					relevance_score: relevanceScore,
					created_at: new Date().toISOString(),
				},
				{
					onConflict: "persona_id,insight_id",
				}
			)
			.select()

		return { data, error }
	}

	/**
	 * Auto-link insights to personas based on interview participants
	 */
	async autoLinkInsightToPersonas(insightId: string) {
		// Find personas for people involved in the interview that generated this insight
		const { data: personaLinks } = await this.db
			.from("themes")
			.select(`
        id,
        interview_id,
        interviews!inner(
          id,
          interview_people!inner(
            person_id,
            people!inner(
              id,
              persona,
              account_id,
              personas!inner(
                id,
                name
              )
            )
          )
        )
      `)
			.eq("id", insightId)
			.not("interviews.interview_people.people.persona", "is", null)

		if (!personaLinks?.length) return { data: [], error: null }

		const linkRecords = personaLinks.flatMap(
			(insight) =>
				insight.interviews?.interview_people
					?.map((ip) => ({
						persona_id: ip.people?.personas?.id,
						insight_id: insightId,
						relevance_score: 1.0,
						created_at: new Date().toISOString(),
					}))
					.filter((record) => record.persona_id) || []
		)

		if (linkRecords.length === 0) return { data: [], error: null }

		const { data, error } = await this.db
			.from("persona_insights")
			.upsert(linkRecords, {
				onConflict: "persona_id,insight_id",
				ignoreDuplicates: true,
			})
			.select()

		return { data, error }
	}

	/**
	 * Get all insights for a persona with relevance scores
	 */
	async getInsightsForPersona(personaId: string) {
		const { data, error } = await this.db
			.from("persona_insights")
			.select(`
        insight_id,
        relevance_score,
        themes!inner(
          id,
          name,
          category,
          impact,
          novelty,
          created_at
        )
      `)
			.eq("persona_id", personaId)
			.order("relevance_score", { ascending: false })

		return { data, error }
	}

	/**
	 * Get all personas for an insight with relevance scores
	 */
	async getPersonasForInsight(insightId: string) {
		const { data, error } = await this.db
			.from("persona_insights")
			.select(`
        persona_id,
        relevance_score,
        personas!inner(
          id,
          name,
          description,
          color_hex,
          percentage
        )
      `)
			.eq("insight_id", insightId)
			.order("relevance_score", { ascending: false })

		return { data, error }
	}
}

/**
 * Combined Junction Table Manager
 * Provides a unified interface to all junction table helpers
 */
export class JunctionTableManager {
	public insightTags: InsightTagsHelper
	public interviewTags: InterviewTagsHelper
	public opportunityInsights: OpportunityInsightsHelper
	public projectPeople: ProjectPeopleHelper
	public personaInsights: PersonaInsightsHelper

	constructor(db: DatabaseClient) {
		this.insightTags = new InsightTagsHelper(db)
		this.interviewTags = new InterviewTagsHelper(db)
		this.opportunityInsights = new OpportunityInsightsHelper(db)
		this.projectPeople = new ProjectPeopleHelper(db)
		this.personaInsights = new PersonaInsightsHelper(db)
	}

	/**
	 * Migrate data from array-based fields to junction tables
	 */
	async migrateArrayData(accountId: string) {
		// Migrate insight related_tags to insight_tags
		const { data: insights } = await this.insightTags.db
			.from("themes")
			.select("id, related_tags")
			.eq("account_id", accountId)
			.not("related_tags", "is", null)

		for (const insight of insights || []) {
			if (insight.related_tags && Array.isArray(insight.related_tags)) {
				await this.insightTags.syncTags({
					insightId: insight.id,
					tags: insight.related_tags,
					accountId,
				})
			}
		}

		// Migrate opportunity related_insight_ids to opportunity_insights
		const { data: opportunities } = await this.opportunityInsights.db
			.from("opportunities")
			.select("id, related_insight_ids")
			.eq("account_id", accountId)
			.not("related_insight_ids", "is", null)

		for (const opportunity of opportunities || []) {
			if (opportunity.related_insight_ids && Array.isArray(opportunity.related_insight_ids)) {
				await this.opportunityInsights.syncInsights({
					opportunityId: opportunity.id,
					insightIds: opportunity.related_insight_ids,
				})
			}
		}
		return { success: true }
	}
}

/**
 * Factory function to create a junction table manager
 */
export function createJunctionTableManager(db: DatabaseClient): JunctionTableManager {
	return new JunctionTableManager(db)
}
