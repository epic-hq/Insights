/**
 * Junction Table Usage Examples
 * Demonstrates how to use the junction table helpers in various scenarios
 */

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
	const { tags, loading, error, addTags, removeTags } = useInsightTags(insightId)

	const handleAddTag = async (newTag: string) => {
		await addTags([newTag], accountId)
		// handle error via UI pattern if needed
	}
	const handleRemoveTag = async (tagToRemove: string) => {
		await removeTags([tagToRemove])
		// handle error via UI pattern if needed
	}

	if (loading) return <div>Loading tags…</div>
	if (error) return <div>Error: {String(error)}</div>

	return (
		<div>
			<h3 className="font-semibold">Tags</h3>
			<div className="mt-2 flex flex-wrap gap-2">
				{(tags || []).map((tag) => (
					<button
						key={tag}
						onClick={() => handleRemoveTag(tag)}
						className="cursor-pointer rounded bg-emerald-100 px-2 py-1 text-emerald-800 hover:bg-emerald-200"
					>
						{tag} ×
					</button>
				))}
			</div>
			<button
				onClick={() => handleAddTag("new-tag")}
				className="mt-3 rounded bg-teal-600 px-3 py-1 text-white hover:bg-teal-700"
			>
				Add Tag
			</button>
		</div>
	)
}

/**
 * EXAMPLE 4: Opportunity insights management
 * Shows how to link insights to opportunities with weights
 */
export function ExampleOpportunityInsightsComponent({ opportunityId }: { opportunityId: string }) {
	const { insights, loading, error, syncInsights } = useOpportunityInsights(opportunityId)

	const handleLinkInsights = async (insightIds: string[]) => {
		// Assign decreasing weights (1.0, 0.9, 0.8, ...)
		const weights = insightIds.reduce(
			(acc, id, index) => {
				acc[id] = Math.max(0, 1 - index * 0.1)
				return acc
			},
			{} as Record<string, number>
		)
		await syncInsights(insightIds, weights)
	}

	if (loading) return <div>Loading linked insights…</div>
	if (error) return <div>Error: {String(error)}</div>

	return (
		<div>
			<h3 className="font-semibold">Linked Insights</h3>
			<div className="mt-2 space-y-2">
				{(insights || []).map((item) => (
					<div key={item.insight_id} className="rounded border p-2">
						<h4 className="font-medium">{item.insights?.name ?? "Untitled"}</h4>
						<p>Weight: {item.weight}</p>
						{item.insights?.impact ? <p>Impact: {item.insights.impact}</p> : null}
					</div>
				))}
			</div>
			<button
				onClick={() => handleLinkInsights((insights || []).map((i) => i.insight_id))}
				className="mt-3 rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-800"
			>
				Re-sync Weights
			</button>
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
		await syncTags(newTags, accountId)
	}
	const handleMigration = async () => {
		await junctionTables.migrateArrayData(accountId)
	}

	return (
		<div>
			<div className="mb-2 text-slate-600 text-sm">Current tags: {(tags || []).join(", ") || "(none)"}</div>
			<button
				onClick={() => handleOptimisticTagUpdate([...(tags || []), "new-tag"])}
				className="mr-2 rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
			>
				Add Tag Optimistically
			</button>
			<button onClick={handleMigration} className="rounded bg-stone-700 px-3 py-1 text-white hover:bg-stone-800">
				Migrate Array Data
			</button>
		</div>
	)
}

/**
 * EXAMPLE 8: Batch operations with junction tables
 * Shows how to perform bulk operations efficiently
 */
type Operation =
	| { type: "sync_insight_tags"; insightId: string; tags: string[] }
	| { type: "sync_opportunity_insights"; opportunityId: string; insightIds: string[]; weights?: Record<string, number> }
	| { type: "auto_link_personas"; insightId: string }

export async function exampleBatchOperations({ request }: ActionFunctionArgs) {
	const manager = await createServerJunctionManager(request)
	const formData = await request.formData()

	const operations: Operation[] = JSON.parse(formData.get("operations")?.toString() || "[]")

	// Batch process multiple insights with tags
	const results = await Promise.all(
		operations.map(async (op) => {
			switch (op.type) {
				case "sync_insight_tags":
					return manager.syncInsightTags(op.insightId, op.tags)

				case "sync_opportunity_insights":
					return manager.syncOpportunityInsights(op.opportunityId, op.insightIds, op.weights)

				case "auto_link_personas":
					return manager.autoLinkInsightToPersonas(op.insightId)

				default:
					return { success: false, error: "Unknown operation" }
			}
		})
	)

	const successCount = results.filter(
		(r: any) => r && (r.error === null || typeof r.error === "undefined") && r.success !== false
	).length
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
{{ ... }}
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
