/**
 * Manually process person_facet embedding queue
 * Run with: npx tsx scripts/process-person-facet-queue.ts
 * For production: npx tsx scripts/process-person-facet-queue.ts production
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

	consola.start("Processing person_facet embedding queue...")

	// Call the database function that processes the queue
	const { data, error } = await supabase.rpc("process_person_facet_embedding_queue")

	if (error) {
		consola.error("Error processing queue:", error)
		return
	}

	consola.success(data || "Queue processed")

	// Wait a bit for processing
	consola.info("Waiting 10 seconds for embeddings to generate...")
	await new Promise((resolve) => setTimeout(resolve, 10000))

	// Check how many embeddings were generated
	const { count: embeddingsCount } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.not("embedding", "is", null)

	consola.box(`✅ Embeddings generated: ${embeddingsCount || 0}`)

	consola.info("Run again if needed, or wait for cron job to process remaining items")
}

main().catch(consola.error)
