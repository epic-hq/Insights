/**
 * Junction Table Usage Examples
 * Demonstrates how to use the junction table helpers in various scenarios
 */

import { Tag } from "lucide-react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useInsightTags, useJunctionTables, useOpportunityInsights } from "../hooks/useJunctionTables"
import { createServerJunctionManager, junctionRouteHelpers } from "./junction-server"

/**
 * EXAMPLE 1: Server-side route loader using junction tables
 * Shows how to load insight data with normalized tags
 */
export async function exampleInsightLoader({ request, params }: LoaderFunctionArgs) {
	const { insightId } = params
	if (!insightId) throw new Error("Insight ID required")

	const manager = await createServerJunctionManager(request)

	// Load insight with tags from junction table
	const { data: tags } = await manager.junctionManager.insightTags.getTagsForInsight(insightId)

	// Load personas linked to this insight
	const { data: personas } = await manager.junctionManager.personaInsights.getPersonasForInsight(insightId)

	// Load opportunities that reference this insight
	const { data: opportunities } =
		await manager.junctionManager.opportunityInsights.getOpportunitiesForInsight(insightId)

	return {
		insightId,
		tags: tags || [],
		personas: personas || [],
		opportunities: opportunities || [],
	}
}

/**
 * EXAMPLE 2: Server-side action for updating insight with tags
 * Shows how to sync tags when an insight is updated
 */
export async function exampleInsightAction({ request, params }: ActionFunctionArgs) {
	const { insightId } = params
	if (!insightId) throw new Error("Insight ID required")

	const formData = await request.formData()
	const tags =
		formData
			.get("tags")
			?.toString()
			.split(",")
			.map((t) => t.trim()) || []

	// Use the route helper for processing insight with tags
	await junctionRouteHelpers.processInsightWithTags(request, insightId, tags)

	return { success: true, message: "Insight tags updated successfully" }
}

/**
 * EXAMPLE 3: React component using junction table hooks
 * Shows how to manage insight tags in the frontend
 */
export function ExampleInsightTagsComponent({ insightId, accountId }: { insightId: string; accountId: string }) {
	const { tags, loading, error, syncTags, addTags, removeTags } = useInsightTags(insightId)

	const _handleAddTag = async (newTag: string) => {
		const result = await addTags([newTag], accountId)
		if (result.success) {
		} else {
			console
		}

		const handleRemoveTag = async (tagToRemove: string) => {
			const result = await removeTags([tagToRemove])
			if (r_handleRemoveTag{
				console.log("Tag removed successfully")
			} else {
				result.error)
			}
		}
		if (loading) return <div>Loading
		tags
	...</div>
	if (error) return <div>Error
	: error </div>

	return (
		<div>
		<h3>Tags </h3>
		< div
	className = "flex flex-wrap gap-2" >
	{
		tags.map(tag => (
			<span
            key= { tag }
            className = "cursor-pointer rounded bg-blue-100 px-2 py-1 text-blue-800"
            onClick = {() => handleRemoveTag(tag)}
		> _span
	_keyg
} ×
</_className
	)) _onClick
}
</div>
	< butto_span
onClick = {() => handleAddTag('new-tag')}
className = "mt-2 rounded bg-green-500 px-3 py-1 text-white" > Add
Tag < />bnottu < / > div
)
}

/**
 * EXAMPLE 4: Opportunity insights management
 * Shows how to link insights to opportunities with weights
 */
export function ExampleOpportunityInsightsComponent({ opportunityId }: { opportunityId: string }) {
	const { insights, loading, error, syncInsights, addInsights } = useOpportunityInsights(opportunityId)

	const handleLinkInsights = async (insightIds: string[]) => {
		// Link insights with different weights based on importance
		const weights = insightIds.reduce(
			(acc, id, index) => {
				acc_handleLinkInsights * 0.1 // Decreasing weights
				return acc
			},
			{} as Record<string, number>
		)

		const result = await syncInsights(insightIds, weights)
		if (result.success) {
			console.log("Insights linked successfully")
		}
	}

	insights
	...</div>
	if (error) return <div>Error
	: error </div>

	return (
		<div>
		<h3>Linked
	Insights < /3>h < div
	className = "space-y-2" >
	{
		insights.map(item => (
			<div key= { item.insight_id } className = "rounded border p-2" >
			<h4>{ item.insights.name } </h4>
			< p > Weight: { item.weight } </p>
			< p > Impact: { item.insights.impact } </p>
		</div>
		)) _div_key_className
	}_h4_h4
		</div>_p
		</div>
)
}

/**
 * EXAMPLE 5: Data migration from arrays to junction tables
 * Shows how to migrate existing array-based data
 */
export async function exampleMigrationAction({ request }: ActionFunctionArgs) {
	const manager = await createServerJunctionManager(request)

	try {
		// Migrate all array-based data for the current account
		const result = await manager.migrateArrayData()

		if (result.success) {
			return {
				success: true,
				message: "Data migration completed successfully",
			}
		}
		return {
			success: false,
			message: "Migration failed",
		}
	} catch (error) {
		return {
			success: false,
			message: `Migration error: ${error instanceof Error ? error.message : "Unknown error"}`,
		}
	}
}

/**
 * EXAMPLE 6: Complex query using multiple junction tables
 * Shows how to get comprehensive data across relationships
 */
export async function exampleComplexQuery({ request, params }: LoaderFunctionArgs) {
	const { projectId } = params
	if (!projectId) throw new Error("Project ID required")

	const manager = await createServerJunctionManager(request)

	// Get project people with their interview stats
	const { data: projectPeople } = await manager.junctionManager.projectPeople.getPeopleForProject(projectId)

	// For each person, get their associated personas and insights
	const enrichedPeople = await Promise.all(
		(projectPeople || []).map(async (person) => {
			// Get insights for this person's persona
			const personaInsights = person.people.persona
				? await manager.junctionManager.personaInsights.getInsightsForPersona(person.people.persona)
				: { data: [] }

			return {
				...person,
				personaInsights: personaInsights.data || [],
			}
		})
	)

	return {
		projectId,
		people: enrichedPeople,
		totalParticipants: projectPeople?.length || 0,
		totalInsights: enrichedPeople.reduce((sum, person) => sum + person.personaInsights.length, 0),
	}
}

/**
 * EXAMPLE 7: Real-time updates using junction tables
 * Shows how to handle real-time updates with optimistic UI
 */
export function ExampleRealTimeComponent({ insightId, accountId }: { insightId: string; accountId: string }) {
	const { tags, syncTags } = useInsightTags(insightId)
	const junctionTables = useJunctionTables()

	const handleOptimisticTagUpdate = async (newTags: string[]) => {
		// Optimistically update UI
		const result = await syncTags(newTags, accountId)

		if (!result.success) {
			// Revert on failure
			console.error("Failed to update tags, reverting...")
			// The hook will automatically reload the correct state
		}
	}
	const handleMigration = async () => {
		try {
			await junctionTables.migrateArrayData(accountId)
			console.log("Migration completed")
		} catch (error) {
			console.error("Migration failed:", error)
		}
	}_handleMigration

	return (
		<div>Current
	:
	</div>
		< button
	onClick = () => handleOptimisticTagUpdate([...tags, 'new-tag']) >
		Add
	Tag
	Optimistically < />bnottu < button
	onClick = handleMigration > Migrate
	Array
	Data < />bnottu < / > div
	)
}

/**
 * EXAMPLE 8:_handleMigrationns with junction tables
 * Shows how to perform bulk operations efficiently
 */
export async function exampleBatchOperations({ request }: ActionFunctionArgs) {
	const manager = await createServerJunctionManager(request)
	const formData = await request.formData()

	const operations = JSON.parse(formData.get("operations")?.toString() || "[]")

	// Batch process multiple insights with tags
	const results = await Promise.all(
		operations.map(async (op: any) => {
			switch (op.type) {
				case "sync_insight_tags":
					return manager.syncInsightTags(op.insightId, op.tags)

				case "sync_opportunity_insights":
					return manager.syncOpportunityInsights(op.opportunityId, op.insightIds, op.weights)

				case "auto_link_personas":
					return manager.autoLinkInsightToPersonas(op.insightId)

				default:
					return { success: false, error: `Unknown operation: ${op.type}` }
			}
		})
	)

	const successCount = results.filter((r) => r.error === null).length
	const errorCount = results.length - successCount

	return {
		success: errorCount === 0,
		message: `Batch operation completed: ${successCount} succeeded, ${errorCount} failed`,
		results,
	}
}

/**
 * USAGE DOCUMENTATION
 *
 * ## Server-Side Usage
 *
 * 1. Import the server junction manager:
 *    ```ts
 *    import { createServerJunctionManager, junctionRouteHelpers } from '~/lib/database/junction-server'
 *    ```
 *
 * 2. Use in route loaders/actions:
 *    ```ts
 *    export async function loader({ request }: LoaderFunctionArgs) {
 *      const manager = await createServerJunctionManager(request)
 *      const tags = await manager.junctionManager.insightTags.getTagsForInsight(insightId)
 *      return { tags }
 *    }
 *    ```
 *
 * 3. Use route helpers for common operations:
 *    ```ts
 *    await junctionRouteHelpers.processInsightWithTags(request, insightId, tags)
 *    ```
 *
 * ## Client-Side Usage
 *
 * 1. Import the hooks:
 *    ```ts
 *    import { useInsightTags, useOpportunityInsights } from '~/lib/hooks/useJunctionTables'
 *    ```
 *
 * 2. Use in React components:
 *    ```tsx
 *    const { tags, loading, error, syncTags } = useInsightTags(insightId)
 *    ```
 *
 * 3. Handle operations with proper error handling:
 *    ```tsx
 *    const result = await syncTags(newTags, accountId)
 *    if (!result.success) {
 *      // Handle error
 *    }
 *    ```
 *
 * ## Migration
 *
 * To migrate existing array-based data:
 *
 * 1. Server-side:
 *    ```ts
 *    const manager = await createServerJunctionManager(request)
 *    await manager.migrateArrayData()
 *    ```
 *
 * 2. Client-side:
 *    ```ts
 *    const junctionTables = useJunctionTables()
 *    await junctionTables.migrateArrayData(accountId)
 *    ```
 */
