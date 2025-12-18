/**
 * Backfill embeddings for existing evidence records
 *
 * This script triggers the DB embedding queue for evidence rows
 * that are missing embeddings. The queue will process them via
 * the embed edge function.
 *
 * Run with: dotenvx run -- npx tsx scripts/backfill-evidence-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js"
import consola from "consola"

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const BATCH_SIZE = 100

async function main() {
	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
		process.exit(1)
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	consola.start("Checking evidence without embeddings...")

	// Count total evidence without embeddings
	const { count: totalMissing, error: countError } = await supabase
		.from("evidence")
		.select("*", { count: "exact", head: true })
		.is("embedding", null)

	if (countError) {
		consola.error("Error counting evidence:", countError)
		return
	}

	if (!totalMissing || totalMissing === 0) {
		consola.success("All evidence records have embeddings!")
		return
	}

	consola.info(`Found ${totalMissing} evidence records without embeddings`)

	// Process in batches
	let processed = 0
	let errors = 0
	let offset = 0

	while (offset < totalMissing) {
		// Fetch batch of evidence without embeddings
		const { data: evidenceBatch, error: fetchError } = await supabase
			.from("evidence")
			.select("id, gist, verbatim")
			.is("embedding", null)
			.order("created_at", { ascending: true })
			.range(offset, offset + BATCH_SIZE - 1)

		if (fetchError) {
			consola.error("Error fetching evidence batch:", fetchError)
			break
		}

		if (!evidenceBatch || evidenceBatch.length === 0) {
			break
		}

		consola.info(`Processing batch ${Math.floor(offset / BATCH_SIZE) + 1} (${evidenceBatch.length} records)...`)

		// Trigger the embedding queue by updating each record
		// The trg_enqueue_evidence trigger will fire and enqueue to pgmq
		for (const evidence of evidenceBatch) {
			const { error: updateError } = await supabase
				.from("evidence")
				.update({ updated_at: new Date().toISOString() })
				.eq("id", evidence.id)

			if (updateError) {
				consola.error(`Failed to update evidence ${evidence.id}:`, updateError.message)
				errors++
			} else {
				processed++
			}
		}

		// Progress indicator
		consola.info(`Progress: ${processed + errors}/${totalMissing} (${errors} errors)`)

		// Rate limit to avoid overwhelming the queue
		await new Promise((resolve) => setTimeout(resolve, 200))

		offset += BATCH_SIZE
	}

	consola.box(`Backfill Summary:
  Total evidence missing embeddings: ${totalMissing}
  Triggered for processing: ${processed}
  Errors: ${errors}

  The cron job will process the queue every minute.
  Check queue size with:
    dotenvx run -- npx tsx scripts/check-queue-size.ts

  Check embedding status with:
    SELECT COUNT(*) as total,
           COUNT(embedding) as with_embedding
    FROM evidence;
  `)

	consola.success("Backfill complete!")
}

main().catch(consola.error)
