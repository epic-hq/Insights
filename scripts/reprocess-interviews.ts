/**
 * Script to prepare interviews for reprocessing by clearing derived data
 *
 * Usage: npx tsx scripts/reprocess-interviews.ts [--dry-run]
 *
 * This will:
 * 1. Delete existing evidence and themes for the project
 * 2. Reset interview status to 'uploaded' so they can be reprocessed
 *
 * After running, use the app UI to trigger reprocessing for each interview.
 */

import { createClient } from "@supabase/supabase-js"
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

// Use the pooler URL directly for remote database
const SUPABASE_URL = "https://rbginqvgkonnoktrttqv.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || ""

if (!SUPABASE_SERVICE_ROLE_KEY) {
	console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env")
	process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false },
})

// Project IDs to reprocess
const PROJECT_IDS = [
	"86fc30e1-1664-4cfc-9ccd-8d4e6e384fe6", // grand-spruce (account 8aa8ad68)
]

const DRY_RUN = process.argv.includes("--dry-run")

async function prepareForReprocessing() {
	console.log(DRY_RUN ? "[DRY RUN] " : "", "Preparing interviews for reprocessing...")

	for (const projectId of PROJECT_IDS) {
		console.log(`\nProcessing project: ${projectId}`)

		// Get all ready interviews with media
		const { data: interviews, error } = await supabase
			.from("interviews")
			.select("id, title, status")
			.eq("project_id", projectId)
			.not("media_url", "is", null)

		if (error) {
			console.error(`Error fetching interviews for project ${projectId}:`, error)
			continue
		}

		if (!interviews || interviews.length === 0) {
			console.log(`No interviews with media found in project ${projectId}`)
			continue
		}

		console.log(`Found ${interviews.length} interviews with media`)

		// Count current data
		const { count: evidenceCount } = await supabase
			.from("evidence")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		const { count: themeCount } = await supabase
			.from("themes")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		const { count: themeEvidenceCount } = await supabase
			.from("theme_evidence")
			.select("*", { count: "exact", head: true })
			.eq("project_id", projectId)

		console.log(`\nCurrent data to be cleared:`)
		console.log(`  - Evidence: ${evidenceCount}`)
		console.log(`  - Themes: ${themeCount}`)
		console.log(`  - Theme-Evidence links: ${themeEvidenceCount}`)

		if (DRY_RUN) {
			console.log("\n[DRY RUN] Would delete the above data and reset interview statuses")
			continue
		}

		// Delete theme_evidence links first (foreign key constraint)
		console.log("\nDeleting theme_evidence links...")
		const { error: teLinkErr } = await supabase
			.from("theme_evidence")
			.delete()
			.eq("project_id", projectId)
		if (teLinkErr) console.error("  Error:", teLinkErr.message)
		else console.log("  Done")

		// Delete themes
		console.log("Deleting themes...")
		const { error: themeErr } = await supabase
			.from("themes")
			.delete()
			.eq("project_id", projectId)
		if (themeErr) console.error("  Error:", themeErr.message)
		else console.log("  Done")

		// Delete evidence_people links
		console.log("Deleting evidence_people links...")
		const { error: epErr } = await supabase
			.from("evidence_people")
			.delete()
			.eq("project_id", projectId)
		if (epErr) console.error("  Error:", epErr.message)
		else console.log("  Done")

		// Delete evidence_facet links
		console.log("Deleting evidence_facet links...")
		const { error: efErr } = await supabase
			.from("evidence_facet")
			.delete()
			.eq("project_id", projectId)
		if (efErr) console.error("  Error:", efErr.message)
		else console.log("  Done")

		// Delete evidence
		console.log("Deleting evidence...")
		const { error: evErr } = await supabase
			.from("evidence")
			.delete()
			.eq("project_id", projectId)
		if (evErr) console.error("  Error:", evErr.message)
		else console.log("  Done")

		// Reset interview statuses
		console.log("\nResetting interview statuses to 'uploaded'...")
		const interviewIds = interviews.map((i) => i.id)
		const { error: statusErr } = await supabase
			.from("interviews")
			.update({
				status: "uploaded",
				conversation_analysis: null,
			})
			.in("id", interviewIds)
		if (statusErr) console.error("  Error:", statusErr.message)
		else console.log(`  Reset ${interviewIds.length} interviews`)
	}

	console.log("\n\nDone! Interviews are now ready for reprocessing.")
	console.log("Go to the app UI and click 'Reprocess' on each interview, or use the bulk reprocess feature.")
}

prepareForReprocessing().catch(console.error)
