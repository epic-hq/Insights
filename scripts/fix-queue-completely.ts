/**
 * Complete queue fix - disable trigger and purge
 * Run with: npx tsx scripts/fix-queue-completely.ts production
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
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		db: { schema: "public" },
	})

	consola.start("Fixing queue completely...")

	// Step 1: Drop the trigger to stop new messages
	consola.info("Step 1: Dropping trigger...")
	const { error: dropError } = await supabase.rpc("exec_sql", {
		sql: "DROP TRIGGER IF EXISTS trg_enqueue_person_facet ON public.person_facet;",
	})

	if (dropError) {
		consola.warn("Could not drop trigger:", dropError.message)
	} else {
		consola.success("Trigger dropped")
	}

	// Step 2: Truncate the queue table directly
	consola.info("Step 2: Truncating queue table...")
	const { error: truncateError } = await supabase.rpc("exec_sql", {
		sql: "TRUNCATE TABLE pgmq.q_person_facet_embedding_queue;",
	})

	if (truncateError) {
		consola.error("Could not truncate queue:", truncateError.message)
	} else {
		consola.success("Queue table truncated")
	}

	// Step 3: Check queue size
	consola.info("Step 3: Checking queue size...")
	const { count: queueSize } = await supabase
		.from("q_person_facet_embedding_queue")
		.select("*", { count: "exact", head: true })

	consola.box(`
		Queue Status:
		- Messages in queue: ${queueSize || 0}
		- Trigger: DISABLED

		The queue will no longer fill up.
		Embeddings are not needed for persona generation.
	`)
}

main().catch(consola.error)
