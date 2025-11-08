/**
 * Backfill embeddings for existing pain facets
 * Calls the edge function for each pain facet that doesn't have an embedding yet
 */

import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
	throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
}

if (!OPENAI_API_KEY) {
	throw new Error("Missing OPENAI_API_KEY in .env")
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
	},
})

async function backfillPainEmbeddings(projectId?: string) {
	consola.info("[backfill-pain-embeddings] Starting backfill...")

	// Get all pain facets without embeddings
	let query = supabaseAdmin
		.from("evidence_facet")
		.select("id, label, kind_slug, project_id")
		.eq("kind_slug", "pain")
		.is("embedding", null)

	if (projectId) {
		query = query.eq("project_id", projectId)
		consola.info(`[backfill-pain-embeddings] Filtering to project: ${projectId}`)
	}

	const { data: painFacets, error } = await query

	if (error) {
		consola.error("[backfill-pain-embeddings] Error fetching pain facets:", error)
		throw error
	}

	if (!painFacets || painFacets.length === 0) {
		consola.success("[backfill-pain-embeddings] No pain facets need backfilling!")
		return
	}

	consola.info(`[backfill-pain-embeddings] Found ${painFacets.length} pain facets to backfill`)

	// Process in batches to avoid overwhelming the edge function
	const BATCH_SIZE = 10
	const DELAY_MS = 1000 // 1 second delay between batches

	let successCount = 0
	let errorCount = 0

	for (let i = 0; i < painFacets.length; i += BATCH_SIZE) {
		const batch = painFacets.slice(i, i + BATCH_SIZE)
		consola.info(
			`[backfill-pain-embeddings] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(painFacets.length / BATCH_SIZE)}`
		)

		// Process batch in parallel
		const results = await Promise.allSettled(
			batch.map(async (facet) => {
				try {
					// Call OpenAI API directly to generate embedding
					const response = await fetch("https://api.openai.com/v1/embeddings", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${OPENAI_API_KEY}`,
						},
						body: JSON.stringify({
							model: "text-embedding-3-small",
							input: facet.label,
							dimensions: 1536,
						}),
					})

					if (!response.ok) {
						const errorText = await response.text()
						throw new Error(`OpenAI API error ${response.status}: ${errorText}`)
					}

					const { data } = await response.json()
					const embedding: number[] = data[0].embedding

					// Update evidence_facet with the embedding
					const { error: updateError } = await supabaseAdmin
						.from("evidence_facet")
						.update({
							embedding: embedding,
							embedding_model: "text-embedding-3-small",
							embedding_generated_at: new Date().toISOString(),
						})
						.eq("id", facet.id)

					if (updateError) throw updateError

					consola.debug(`[backfill-pain-embeddings] ✓ ${facet.label}`)
					return { success: true, facet_id: facet.id }
				} catch (err) {
					consola.error(`[backfill-pain-embeddings] ✗ Failed for "${facet.label}":`, err)
					throw err
				}
			})
		)

		// Count successes and failures
		for (const result of results) {
			if (result.status === "fulfilled") {
				successCount++
			} else {
				errorCount++
			}
		}

		// Delay between batches to avoid rate limits
		if (i + BATCH_SIZE < painFacets.length) {
			consola.debug(`[backfill-pain-embeddings] Waiting ${DELAY_MS}ms before next batch...`)
			await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
		}
	}

	consola.success(`[backfill-pain-embeddings] Backfill complete! Success: ${successCount}, Failed: ${errorCount}`)

	// Verify embeddings were created
	const { data: verifyData } = await supabaseAdmin
		.from("evidence_facet")
		.select("id")
		.eq("kind_slug", "pain")
		.is("embedding", null)

	const remaining = verifyData?.length || 0
	consola.info(`[backfill-pain-embeddings] Remaining facets without embeddings: ${remaining}`)
}

// Run the backfill
const projectId = process.argv[2] // Optional: filter to specific project

backfillPainEmbeddings(projectId)
	.then(() => {
		consola.success("[backfill-pain-embeddings] Done!")
		process.exit(0)
	})
	.catch((err) => {
		consola.error("[backfill-pain-embeddings] Fatal error:", err)
		process.exit(1)
	})
