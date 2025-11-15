/**
 * Generate embeddings for a specific project's person_facets
 * Bypasses the global queue to prioritize one project
 * Run with: npx tsx scripts/generate-embeddings-for-project.ts
 * For production: npx tsx scripts/generate-embeddings-for-project.ts production
 */

import dotenvx from "@dotenvx/dotenvx"
import { createClient } from "@supabase/supabase-js"
import consola from "consola"

// Load environment variables
const env = process.argv.find((arg) => arg === "production" || arg === "prod") ? "production" : ""
const envPath = `.env${env ? `.${env}` : ""}`
dotenvx.config({ path: envPath })
consola.info(`Loaded environment from ${envPath}`)

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROJECT_ID = "6dbcbb68-0662-4ebc-9f84-dd13b8ff758d" // UpSight Interviews

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	consola.start(`Generating embeddings for project ${PROJECT_ID}...`)

	// Get all person_facets for this project without embeddings
	const { data: personFacets, error } = await supabase
		.from("person_facet")
		.select(
			`
      person_id,
      facet_account_id,
      facet:facet_account!inner(
        label,
        facet_kind_global!inner(slug)
      )
    `
		)
		.eq("project_id", PROJECT_ID)
		.is("embedding", null)

	if (error) {
		consola.error("Error:", error)
		return
	}

	consola.info(`Found ${personFacets?.length || 0} person_facets without embeddings`)

	// Trigger them all by updating
	let processed = 0

	for (const pf of personFacets || []) {
		const { error: updateError } = await supabase
			.from("person_facet")
			.update({ updated_at: new Date().toISOString() })
			.eq("person_id", pf.person_id)
			.eq("facet_account_id", pf.facet_account_id)

		if (!updateError) {
			processed++
			if (processed % 20 === 0) {
				consola.info(`Enqueued: ${processed}/${personFacets.length}`)
			}
		}
	}

	consola.success(`Enqueued ${processed} person_facets`)

	// Now manually process the queue to generate embeddings immediately
	consola.info("\nProcessing queue to generate embeddings...")

	for (let i = 0; i < 15; i++) {
		const { data } = await supabase.rpc("process_person_facet_embedding_queue")
		consola.info(`Batch ${i + 1}: ${data}`)
		await new Promise((r) => setTimeout(r, 3000))
	}

	// Check results
	consola.info("\nChecking embeddings generated...")
	await new Promise((r) => setTimeout(r, 10000))

	const { count: embeddings } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.eq("project_id", PROJECT_ID)
		.not("embedding", "is", null)

	const { count: total } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.eq("project_id", PROJECT_ID)

	consola.box(`
  UpSight Interviews Project:
  - Total person_facets: ${total}
  - With embeddings: ${embeddings}
  - Progress: ${Math.round(((embeddings || 0) / (total || 1)) * 100)}%

  The cron will continue processing the queue.
  Refresh your ICP page to see results!
  `)
}

main().catch(consola.error)
