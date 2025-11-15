/**
 * Check the actual size of person_facet_embedding_queue
 * Run with: npx tsx scripts/check-queue-size.ts production
 */

import { createClient } from "@supabase/supabase-js"
import consola from "consola"
import dotenvx from "@dotenvx/dotenvx"

// Load environment variables
const env = process.argv.find((arg) => arg === "production" || arg === "prod") ? "production" : ""
const envPath = `.env${env ? `.${env}` : ""}`
dotenvx.config({ path: envPath })
consola.info(`Loaded environment from ${envPath}`)

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	consola.start("Checking queue size...")

	// Try direct count query on the queue table
	const { count: queueCount, error: countError } = await supabase
		.from("q_person_facet_embedding_queue")
		.select("*", { count: "exact", head: true })

	if (countError) {
		consola.error("Error counting queue:", countError)

		// Try with schema prefix
		const { data: rawData, error: rawError } = await supabase
			.rpc("pgmq.metrics_all")

		if (rawError) {
			consola.error("Error getting metrics:", rawError)
		} else {
			consola.info("Queue metrics:", rawData)
		}
	} else {
		consola.success(`Queue has ${queueCount} messages`)
	}

	// Check person_facet stats
	const { count: totalPersonFacets } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })

	const { count: withEmbeddings } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.not("embedding", "is", null)

	consola.box(`
		Person Facet Stats:
		- Total: ${totalPersonFacets}
		- With embeddings: ${withEmbeddings}
		- Missing embeddings: ${(totalPersonFacets || 0) - (withEmbeddings || 0)}
		- Progress: ${Math.round(((withEmbeddings || 0) / (totalPersonFacets || 1)) * 100)}%

		Queue size: ${queueCount || "unknown"}
	`)
}

main().catch(consola.error)
