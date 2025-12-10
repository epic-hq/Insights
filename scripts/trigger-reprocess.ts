/**
 * Script to trigger full reprocessing for all uploaded interviews in a project
 *
 * Usage: TRIGGER_SECRET_KEY=tr_prod_xxx npx tsx scripts/trigger-reprocess.ts
 *
 * Uses Trigger.dev SDK with TRIGGER_SECRET_KEY to trigger tasks
 */

import { createClient } from "@supabase/supabase-js"
import { tasks } from "@trigger.dev/sdk"
import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

// Read .env file manually
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, "..", ".env")
const envContent = readFileSync(envPath, "utf-8")
const envVars = Object.fromEntries(
	envContent.split("\n")
		.filter(line => line.includes("=") && !line.startsWith("#"))
		.map(line => {
			const [key, ...values] = line.split("=")
			return [key.trim(), values.join("=").trim().replace(/^["']|["']$/g, "")]
		})
)

// Production Supabase
const SUPABASE_URL = "https://rbginqvgkonnoktrttqv.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || ""

if (!SUPABASE_SERVICE_ROLE_KEY) {
	console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env")
	process.exit(1)
}

if (!process.env.TRIGGER_SECRET_KEY) {
	console.error("Missing TRIGGER_SECRET_KEY environment variable")
	console.error("Usage: TRIGGER_SECRET_KEY=tr_prod_xxx npx tsx scripts/trigger-reprocess.ts")
	process.exit(1)
}

console.log("Using TRIGGER_SECRET_KEY:", process.env.TRIGGER_SECRET_KEY.substring(0, 12) + "...")

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
})

// Project to reprocess
const PROJECT_ID = "86fc30e1-1664-4cfc-9ccd-8d4e6e384fe6"

async function triggerReprocessing() {
	console.log("Fetching uploaded interviews...")

	// Get all uploaded interviews with media
	const { data: interviews, error } = await supabase
		.from("interviews")
		.select("id, title, media_url, account_id, project_id, created_by")
		.eq("project_id", PROJECT_ID)
		.eq("status", "uploaded")
		.not("media_url", "is", null)

	if (error) {
		console.error("Error fetching interviews:", error)
		process.exit(1)
	}

	if (!interviews || interviews.length === 0) {
		console.log("No uploaded interviews with media found")
		process.exit(0)
	}

	console.log(`Found ${interviews.length} interviews to reprocess\n`)

	// Process interviews sequentially
	for (const interview of interviews) {
		console.log(`Processing: ${interview.title} (${interview.id})`)

		try {
			// Create transcript data
			const transcriptData = {
				needs_transcription: true,
				media_url: interview.media_url,
				file_type: "media",
			}

			// Update status to processing
			await supabase
				.from("interviews")
				.update({ status: "processing" })
				.eq("id", interview.id)

			// Trigger the v2 orchestrator via SDK
			const handle = await tasks.trigger("interview.v2.orchestrator", {
				analysisJobId: interview.id,
				metadata: {
					accountId: interview.account_id,
					userId: interview.created_by,
					projectId: interview.project_id,
					interviewTitle: interview.title,
				},
				transcriptData,
				mediaUrl: interview.media_url,
				existingInterviewId: interview.id,
			})

			// Update conversation_analysis with run ID
			await supabase
				.from("interviews")
				.update({
					conversation_analysis: {
						trigger_run_id: handle.id,
						status_detail: "Reprocessing started",
						current_step: "transcription",
					},
				})
				.eq("id", interview.id)

			console.log(`  Triggered run: ${handle.id}`)
		} catch (err) {
			console.error(`  Failed:`, err instanceof Error ? err.message : err)

			// Reset status on error
			await supabase
				.from("interviews")
				.update({ status: "error" })
				.eq("id", interview.id)
		}

		// Wait between triggers
		await new Promise(resolve => setTimeout(resolve, 2000))
	}

	console.log("\n\nDone! Reprocessing has been triggered for all interviews.")
	console.log("Monitor progress in the Trigger.dev dashboard or the app UI.")
}

triggerReprocessing().catch(console.error)
