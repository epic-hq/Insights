/**
 * Compute Survey Statistics
 *
 * Triggers stats computation for surveys that have responses.
 * Use this to populate the statistics column for existing surveys.
 *
 * Usage:
 *   TRIGGER_SECRET_KEY=tr_prod_xxx pnpm tsx scripts/compute-survey-stats.ts
 *
 * Options (via environment variables):
 *   PROJECT_ID       - Filter to specific project
 *   RESEARCH_LINK_ID - Filter to specific survey
 */

import { createClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";

async function main() {
	// Validate trigger key
	if (!process.env.TRIGGER_SECRET_KEY) {
		consola.error("Missing TRIGGER_SECRET_KEY environment variable");
		consola.info("Usage: TRIGGER_SECRET_KEY=tr_prod_xxx pnpm tsx scripts/compute-survey-stats.ts");
		process.exit(1);
	}

	if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
		consola.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
		process.exit(1);
	}

	const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

	consola.info("Using TRIGGER_SECRET_KEY:", process.env.TRIGGER_SECRET_KEY.substring(0, 12) + "...");

	// Parse optional filters from environment
	const projectId = process.env.PROJECT_ID || undefined;
	const researchLinkId = process.env.RESEARCH_LINK_ID || undefined;

	consola.start("Finding surveys with responses...");

	// Build query for research links
	let query = db.from("research_links").select("id, name, project_id");

	if (researchLinkId) {
		query = query.eq("id", researchLinkId);
	} else if (projectId) {
		query = query.eq("project_id", projectId);
	}

	const { data: links, error: linksError } = await query;

	if (linksError) {
		consola.error("Failed to fetch research links:", linksError);
		process.exit(1);
	}

	if (!links || links.length === 0) {
		consola.warn("No research links found");
		process.exit(0);
	}

	// Filter to links that have at least one completed response
	const linksWithResponses: typeof links = [];
	for (const link of links) {
		const { count } = await db
			.from("research_link_responses")
			.select("id", { count: "exact", head: true })
			.eq("research_link_id", link.id)
			.eq("completed", true);

		if (count && count > 0) {
			linksWithResponses.push(link);
		}
	}

	consola.info(`Found ${linksWithResponses.length} surveys with completed responses`);

	// Trigger stats computation for each
	let triggered = 0;
	for (const link of linksWithResponses) {
		try {
			const handle = await tasks.trigger("survey.compute-stats", {
				researchLinkId: link.id,
			});
			consola.success(`Triggered stats for "${link.name}": ${handle.id}`);
			triggered++;
		} catch (err) {
			consola.error(`Failed to trigger for ${link.name}:`, err);
		}
	}

	consola.success(`Triggered stats computation for ${triggered} surveys`);
	consola.info("Monitor progress in the Trigger.dev dashboard");
}

main().catch((err) => {
	consola.error("Script failed:", err);
	process.exit(1);
});
