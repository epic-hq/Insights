/**
 * Directly generate embeddings for person_facet records
 * Bypasses queue/edge functions - calls OpenAI and updates DB directly
 * Run with: npx tsx scripts/direct-generate-person-facet-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

async function generateEmbedding(text: string): Promise<number[]> {
	const response = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			model: "text-embedding-3-small",
			input: text,
			dimensions: 1536,
		}),
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`OpenAI API error: ${error}`)
	}

	const { data } = await response.json()
	return data[0].embedding
}

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	consola.start("Generating embeddings for person_facet records...")

	// Get all person_facets without embeddings
	const { data: personFacets, error: fetchError } = await supabase
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
		.is("embedding", null)
		.limit(200) // Process 200 at a time to avoid rate limits

	if (fetchError) {
		consola.error("Error fetching person_facets:", fetchError)
		return
	}

	if (!personFacets || personFacets.length === 0) {
		consola.success("No person_facets need embeddings!")
		return
	}

	consola.info(`Found ${personFacets.length} person_facets without embeddings`)
	consola.info("Generating embeddings...")

	let generated = 0
	let errors = 0

	for (const pf of personFacets) {
		const label = (pf.facet as any)?.label
		const kindSlug = (pf.facet as any)?.facet_kind_global?.slug

		if (!label || !kindSlug) {
			consola.warn(`Skipping ${pf.person_id}|${pf.facet_account_id} - missing label`)
			errors++
			continue
		}

		try {
			// Generate embedding
			const embedding = await generateEmbedding(label)

			// Update database
			const { error: updateError } = await supabase
				.from("person_facet")
				.update({
					embedding: `[${embedding.join(",")}]`,
					embedding_model: "text-embedding-3-small",
					embedding_generated_at: new Date().toISOString(),
				})
				.eq("person_id", pf.person_id)
				.eq("facet_account_id", pf.facet_account_id)

			if (updateError) {
				consola.error(`Failed to update ${pf.person_id}|${pf.facet_account_id}:`, updateError.message)
				errors++
			} else {
				generated++
				if (generated % 10 === 0) {
					consola.info(`Progress: ${generated}/${personFacets.length}`)
				}
			}

			// Rate limit: 50 req/min for tier 1 = 1.2 seconds between requests
			await new Promise((resolve) => setTimeout(resolve, 1300))
		} catch (error: any) {
			consola.error(`Error for ${pf.person_id}|${pf.facet_account_id}:`, error.message)
			errors++
			// Back off on errors
			await new Promise((resolve) => setTimeout(resolve, 5000))
		}
	}

	consola.box(`Generation Summary:
  Total processed: ${personFacets.length}
  Generated: ${generated}
  Errors: ${errors}

  Run the debug script to verify:
    dotenvx run -- npx tsx scripts/debug-icp-data.ts
  `)

	consola.success("Complete!")
}

main().catch(consola.error)
