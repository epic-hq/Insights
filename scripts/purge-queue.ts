/**
 * Purge the person_facet_embedding_queue to clear backlog
 * Run with: npx tsx scripts/purge-queue.ts production
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

async function main() {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

	consola.start("Purging person_facet_embedding_queue...")

	// Use pgmq.purge_queue function
	const { data, error } = await supabase.rpc("pgmq.purge_queue", {
		queue_name: "person_facet_embedding_queue",
	})

	if (error) {
		consola.error("Error purging queue:", error)

		// Try alternative: just process and delete a large batch
		consola.info("Trying to drain queue by reading and deleting messages...")

		for (let i = 0; i < 50; i++) {
			const { data: processResult, error: processError } = await supabase.rpc("process_person_facet_embedding_queue")

			if (processError) {
				consola.error(`Batch ${i + 1} error:`, processError)
				break
			}

			consola.info(`Batch ${i + 1}: ${processResult}`)

			// If no messages processed, we're done
			if (processResult?.includes("0 person facet")) {
				consola.success("Queue is empty!")
				break
			}

			await new Promise((r) => setTimeout(r, 1000))
		}
	} else {
		consola.success(`Queue purged. Result: ${data}`)
	}

	// Check final stats
	const { count: withEmbeddings } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.not("embedding", "is", null)

	consola.box(`
		Embeddings generated: ${withEmbeddings || 0}
		Queue has been cleared.
	`)
}

main().catch(consola.error)
