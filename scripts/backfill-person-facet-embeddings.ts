/**
 * Backfill embeddings for existing person_facet records
 * Run with: npx tsx scripts/backfill-person-facet-embeddings.ts
 */

import { createClient } from "@supabase/supabase-js";
import consola from "consola";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	consola.start("Backfilling person_facet embeddings...");

	// Get all person_facets without embeddings
	const { data: personFacets, error: fetchError } = await supabase
		.from("person_facet")
		.select(
			`
      person_id,
      facet_account_id,
      embedding,
      facet:facet_account!inner(
        label,
        facet_kind_global!inner(
          slug
        )
      )
    `
		)
		.is("embedding", null);

	if (fetchError) {
		consola.error("Error fetching person_facets:", fetchError);
		return;
	}

	if (!personFacets || personFacets.length === 0) {
		consola.success("No person_facets need embedding backfill!");
		return;
	}

	consola.info(`Found ${personFacets.length} person_facets without embeddings`);

	// Trigger the existing enqueue function by updating each record
	// This will fire the trigger we created which enqueues to pgmq
	let processed = 0;
	let errors = 0;

	consola.info("Triggering embeddings by updating person_facet records...");

	for (const pf of personFacets) {
		// Update the record to trigger the embedding generation
		// We update the updated_at timestamp which will fire the trigger
		const { error: updateError } = await supabase
			.from("person_facet")
			.update({ updated_at: new Date().toISOString() })
			.eq("person_id", pf.person_id)
			.eq("facet_account_id", pf.facet_account_id);

		if (updateError) {
			consola.error(`Failed to update ${pf.person_id}|${pf.facet_account_id}:`, updateError.message);
			errors++;
		} else {
			processed++;
		}

		// Progress indicator
		if ((processed + errors) % 20 === 0) {
			consola.info(`Progress: ${processed + errors}/${personFacets.length}`);
		}

		// Rate limit to avoid overwhelming the queue
		if (processed % 50 === 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	consola.box(`Backfill Summary:
  Total person_facets: ${personFacets.length}
  Processed: ${processed}
  Errors: ${errors}

  The cron job will process these in ~1 minute.
  Run the debug script to check progress:
    dotenvx run -- npx tsx scripts/debug-icp-data.ts
  `);

	consola.success("Backfill complete!");
}

main().catch(consola.error);
