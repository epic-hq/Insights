/**
 * Backfill Survey Evidence
 *
 * Triggers evidence extraction for all completed survey responses.
 * Creates evidence records from text answers so they can be searched,
 * themed, and analyzed alongside interview evidence.
 *
 * Usage:
 *   TRIGGER_SECRET_KEY=tr_prod_xxx pnpm tsx scripts/backfill-survey-evidence.ts
 *
 * Options (via environment variables):
 *   PROJECT_ID       - Filter to specific project
 *   RESEARCH_LINK_ID - Filter to specific survey
 *   FORCE            - Reprocess even if evidence exists (default: false)
 */

import { tasks } from "@trigger.dev/sdk"
import consola from "consola"

async function main() {
	// Validate trigger key
	if (!process.env.TRIGGER_SECRET_KEY) {
		consola.error("Missing TRIGGER_SECRET_KEY environment variable")
		consola.info("Usage: TRIGGER_SECRET_KEY=tr_prod_xxx pnpm tsx scripts/backfill-survey-evidence.ts")
		process.exit(1)
	}

	consola.info("Using TRIGGER_SECRET_KEY:", process.env.TRIGGER_SECRET_KEY.substring(0, 12) + "...")

	// Parse optional filters from environment
	const projectId = process.env.PROJECT_ID || undefined
	const researchLinkId = process.env.RESEARCH_LINK_ID || undefined
	const force = process.env.FORCE === "true"

	consola.start("Triggering survey evidence backfill task")
	consola.info("Options:", {
		projectId: projectId || "(all)",
		researchLinkId: researchLinkId || "(all)",
		force,
	})

	try {
		const handle = await tasks.trigger("survey.backfill-evidence", {
			projectId,
			researchLinkId,
			force,
		})

		consola.success(`Backfill task triggered: ${handle.id}`)
		consola.info("Monitor progress in the Trigger.dev dashboard:")
		consola.info(`  https://cloud.trigger.dev/runs/${handle.id}`)
	} catch (err) {
		consola.error("Failed to trigger backfill task:", err)
		process.exit(1)
	}
}

main().catch((err) => {
	consola.error("Script failed:", err)
	process.exit(1)
})
