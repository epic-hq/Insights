/**
 * Debug person_facet embedding queue
 * Run with: npx tsx scripts/debug-person-facet-queue.ts production
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

	consola.start("Debugging person_facet embedding queue...")

	// Check queue size
	const { data: queueMetrics, error: metricsError } = await supabase.rpc("pgmq.metrics", {
		queue_name: "person_facet_embedding_queue",
	})

	if (metricsError) {
		consola.warn("Could not get queue metrics, trying direct query...")

		// Try direct query
		const { data: queueData, error: queueError } = await supabase
			.from("pgmq.q_person_facet_embedding_queue")
			.select("*", { count: "exact" })
			.limit(5)

		if (queueError) {
			consola.error("Error querying queue:", queueError)
		} else {
			consola.info(`Queue has ${queueData?.length || 0} messages (showing first 5)`)
			if (queueData && queueData.length > 0) {
				consola.info("Sample messages:", queueData)
			}
		}
	} else {
		consola.info("Queue metrics:", queueMetrics)
	}

	// Check cron jobs
	consola.info("\nChecking cron jobs...")
	const { data: cronJobs, error: cronError } = await supabase.rpc("cron.job", {})

	if (cronError) {
		consola.warn("Could not query cron jobs:", cronError.message)
	} else {
		consola.info("Cron jobs:", cronJobs)
	}

	// Check if edge function exists by trying to call it with a test payload
	consola.info("\nTesting edge function invocation...")
	const testPayload = {
		person_id: "test-id",
		facet_account_id: 999,
		label: "Test Label",
		kind_slug: "test_kind",
	}

	const { data: edgeFunctionTest, error: edgeFunctionError } = await supabase.functions.invoke(
		"embed-person-facet",
		{
			body: testPayload,
		}
	)

	if (edgeFunctionError) {
		consola.error("Edge function error:", edgeFunctionError)
	} else {
		consola.info("Edge function test response:", edgeFunctionTest)
	}

	// Try to manually read from queue
	consola.info("\nTrying to read messages from queue...")
	const { data: readResult, error: readError } = await supabase.rpc("pgmq.read", {
		queue_name: "person_facet_embedding_queue",
		vt: 30,
		qty: 5,
	})

	if (readError) {
		consola.error("Error reading from queue:", readError)
	} else {
		consola.info(`Read ${readResult?.length || 0} messages:`, readResult)
	}

	// Check how many person_facets are missing embeddings
	const { count: missingEmbeddings } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })
		.is("embedding", null)

	const { count: totalPersonFacets } = await supabase
		.from("person_facet")
		.select("*", { count: "exact", head: true })

	consola.box(`
		Person Facets Summary:
		- Total: ${totalPersonFacets}
		- Missing embeddings: ${missingEmbeddings}
		- With embeddings: ${(totalPersonFacets || 0) - (missingEmbeddings || 0)}
		- Progress: ${Math.round((((totalPersonFacets || 0) - (missingEmbeddings || 0)) / (totalPersonFacets || 1)) * 100)}%
	`)
}

main().catch(consola.error)
