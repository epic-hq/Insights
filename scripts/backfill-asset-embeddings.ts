/**
 * Script to trigger asset embedding backfill
 *
 * Usage: TRIGGER_SECRET_KEY=xxx npx tsx scripts/backfill-asset-embeddings.ts [projectId]
 */

import { tasks } from "@trigger.dev/sdk/v3"

async function main() {
	const projectId = process.argv[2] // Optional project ID filter

	console.log("Triggering asset embedding backfill...")
	console.log("Project ID filter:", projectId || "none (all projects)")

	const handle = await tasks.trigger("asset.backfill-embeddings", {
		projectId: projectId || undefined,
		limit: 100,
	})

	console.log("Backfill task triggered!")
	console.log("Run ID:", handle.id)
	console.log("View in dashboard: https://cloud.trigger.dev/")
}

main().catch(console.error)
