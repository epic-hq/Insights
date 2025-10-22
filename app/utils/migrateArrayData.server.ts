/**
 * Migration utility to convert array-based data to normalized junction tables
 * Migrates: related_tags -> insight_tags, related_insight_ids -> opportunity_insights
 */

import consola from "consola"
import { getServerClient } from "~/lib/supabase/client.server"

interface MigrationStats {
	insightTagsMigrated: number
	opportunityInsightsMigrated: number
	errors: string[]
	totalProcessed: number
}

/**
 * Migrate insights.related_tags to insight_tags junction table
 */
async function migrateInsightTags(
	request: Request,
	accountId: string
): Promise<{ migrated: number; errors: string[] }> {
	const { client: supabase } = getServerClient(request)

	const errors: string[] = []
	let migrated = 0

	try {
		// Get all insights with related_tags arrays
		const { data: insights, error } = await supabase
			.from("insights")
			.select("id, related_tags")
			.eq("account_id", accountId)
			.not("related_tags", "is", null)

		if (error) {
			errors.push(`Failed to fetch insights: ${error.message}`)
			return { migrated: 0, errors }
		}

		if (!insights || insights.length === 0) {
			consola.info("No insights with related_tags found to migrate")
			return { migrated: 0, errors }
		}

		consola.info(`Found ${insights.length} insights with related_tags to migrate`)

		// Migrate each insight's tags
		for (const insight of insights) {
			if (!insight.related_tags || !Array.isArray(insight.related_tags)) {
				continue
			}

			try {
				// Direct database operations - no abstractions
				// First, create/get tag records
				for (const tagName of insight.related_tags) {
					// Upsert tag
					await supabase.from("tags").upsert(
						{
							tag: tagName,
							account_id: accountId,
						},
						{
							onConflict: "tag,account_id",
						}
					)

					// Create junction record
					await supabase.from("insight_tags").upsert(
						{
							insight_id: insight.id,
							tag: tagName,
							account_id: accountId,
						},
						{
							onConflict: "insight_id,tag,account_id",
						}
					)
				}

				// Clear the array field after successful migration
				await supabase.from("insights").update({ related_tags: null }).eq("id", insight.id).eq("account_id", accountId)

				migrated++
				consola.success(`Migrated ${insight.related_tags.length} tags for insight ${insight.id}`)
			} catch (err) {
				const errorMsg = `Failed to migrate tags for insight ${insight.id}: ${err instanceof Error ? err.message : "Unknown error"}`
				errors.push(errorMsg)
				consola.error(errorMsg)
			}
		}

		return { migrated, errors }
	} catch (err) {
		const errorMsg = `Migration failed: ${err instanceof Error ? err.message : "Unknown error"}`
		errors.push(errorMsg)
		return { migrated, errors }
	}
}

/**
 * Migrate opportunities.related_insight_ids to opportunity_insights junction table
 */
async function migrateOpportunityInsights(
	request: Request,
	accountId: string
): Promise<{ migrated: number; errors: string[] }> {
	const { client: supabase } = getServerClient(request)

	const errors: string[] = []
	let migrated = 0

	try {
		// Get all opportunities with related_insight_ids arrays
		const { data: opportunities, error } = await supabase
			.from("opportunities")
			.select("id, related_insight_ids")
			.eq("account_id", accountId)
			.not("related_insight_ids", "is", null)

		if (error) {
			errors.push(`Failed to fetch opportunities: ${error.message}`)
			return { migrated: 0, errors }
		}

		if (!opportunities || opportunities.length === 0) {
			consola.info("No opportunities with related_insight_ids found to migrate")
			return { migrated: 0, errors }
		}

		consola.info(`Found ${opportunities.length} opportunities with related_insight_ids to migrate`)

		// Migrate each opportunity's insights
		for (const opportunity of opportunities) {
			if (!opportunity.related_insight_ids || !Array.isArray(opportunity.related_insight_ids)) {
				continue
			}

			try {
				// Direct database operations - create junction records
				for (const insightId of opportunity.related_insight_ids) {
					await supabase.from("opportunity_insights").upsert(
						{
							opportunity_id: opportunity.id,
							insight_id: insightId,
							weight: 1.0, // Default weight
							account_id: accountId,
						},
						{
							onConflict: "opportunity_id,insight_id,account_id",
						}
					)
				}

				// Clear the array field after successful migration
				await supabase
					.from("opportunities")
					.update({ related_insight_ids: null })
					.eq("id", opportunity.id)
					.eq("account_id", accountId)

				migrated++
				consola.success(`Migrated ${opportunity.related_insight_ids.length} insights for opportunity ${opportunity.id}`)
			} catch (err) {
				const errorMsg = `Failed to migrate insights for opportunity ${opportunity.id}: ${err instanceof Error ? err.message : "Unknown error"}`
				errors.push(errorMsg)
				consola.error(errorMsg)
			}
		}

		return { migrated, errors }
	} catch (err) {
		const errorMsg = `Migration failed: ${err instanceof Error ? err.message : "Unknown error"}`
		errors.push(errorMsg)
		return { migrated, errors }
	}
}

/**
 * Run complete array-to-junction migration for an account
 */
export async function migrateArrayDataToJunctions(request: Request, accountId: string): Promise<MigrationStats> {
	consola.info(`Starting array-to-junction migration for account ${accountId}`)

	const stats: MigrationStats = {
		insightTagsMigrated: 0,
		opportunityInsightsMigrated: 0,
		errors: [],
		totalProcessed: 0,
	}

	try {
		// Migrate insight tags
		const insightTagsResult = await migrateInsightTags(request, accountId)
		stats.insightTagsMigrated = insightTagsResult.migrated
		stats.errors.push(...insightTagsResult.errors)

		// Migrate opportunity insights
		const opportunityInsightsResult = await migrateOpportunityInsights(request, accountId)
		stats.opportunityInsightsMigrated = opportunityInsightsResult.migrated
		stats.errors.push(...opportunityInsightsResult.errors)

		stats.totalProcessed = stats.insightTagsMigrated + stats.opportunityInsightsMigrated

		consola.info(`Migration completed: ${stats.totalProcessed} items migrated, ${stats.errors.length} errors`)

		return stats
	} catch (err) {
		const errorMsg = `Migration failed: ${err instanceof Error ? err.message : "Unknown error"}`
		stats.errors.push(errorMsg)
		consola.error(errorMsg)
		return stats
	}
}

/**
 * Get migration status - check how much data needs to be migrated
 */
export async function getMigrationStatus(request: Request, accountId: string) {
	const { client: supabase } = getServerClient(request)

	try {
		// Count insights with related_tags
		const { count: insightsWithTags } = await supabase
			.from("insights")
			.select("*", { count: "exact", head: true })
			.eq("account_id", accountId)
			.not("related_tags", "is", null)

		// Count opportunities with related_insight_ids
		const { count: opportunitiesWithInsights } = await supabase
			.from("opportunities")
			.select("*", { count: "exact", head: true })
			.eq("account_id", accountId)
			.not("related_insight_ids", "is", null)

		// Count existing junction table records
		const { count: existingInsightTags } = await supabase
			.from("insight_tags")
			.select("*", { count: "exact", head: true })
			.eq("account_id", accountId)

		const { count: existingOpportunityInsights } = await supabase
			.from("opportunity_insights")
			.select("*", { count: "exact", head: true })
			.eq("account_id", accountId)

		return {
			needsMigration: {
				insightsWithTags: insightsWithTags || 0,
				opportunitiesWithInsights: opportunitiesWithInsights || 0,
				total: (insightsWithTags || 0) + (opportunitiesWithInsights || 0),
			},
			existing: {
				insightTags: existingInsightTags || 0,
				opportunityInsights: existingOpportunityInsights || 0,
				total: (existingInsightTags || 0) + (existingOpportunityInsights || 0),
			},
		}
	} catch (err) {
		consola.error("Failed to get migration status:", err)
		throw err
	}
}
