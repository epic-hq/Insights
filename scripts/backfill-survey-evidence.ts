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
 *   ACCOUNT_ID     - Filter to specific account
 *   PROJECT_ID     - Filter to specific project
 *   RESEARCH_LINK_ID - Filter to specific survey
 *   LIMIT          - Max responses to process (default: all)
 *   SKIP_EXISTING  - Skip responses with existing evidence (default: true)
 */

import { tasks } from "@trigger.dev/sdk";
import consola from "consola";

async function main() {
  // Validate trigger key
  if (!process.env.TRIGGER_SECRET_KEY) {
    consola.error("Missing TRIGGER_SECRET_KEY environment variable");
    consola.info(
      "Usage: TRIGGER_SECRET_KEY=tr_prod_xxx pnpm tsx scripts/backfill-survey-evidence.ts",
    );
    process.exit(1);
  }

  consola.info(
    "Using TRIGGER_SECRET_KEY:",
    process.env.TRIGGER_SECRET_KEY.substring(0, 12) + "...",
  );

  // Parse optional filters from environment
  const accountId = process.env.ACCOUNT_ID || undefined;
  const projectId = process.env.PROJECT_ID || undefined;
  const researchLinkId = process.env.RESEARCH_LINK_ID || undefined;
  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : undefined;
  const skipExisting = process.env.SKIP_EXISTING !== "false";

  consola.start("Triggering survey evidence backfill task");
  consola.info("Filters:", {
    accountId: accountId || "(all)",
    projectId: projectId || "(all)",
    researchLinkId: researchLinkId || "(all)",
    limit: limit || "(no limit)",
    skipExisting,
  });

  try {
    const handle = await tasks.trigger("survey.backfill-evidence", {
      accountId,
      projectId,
      researchLinkId,
      limit,
      skipExisting,
    });

    consola.success(`Backfill task triggered: ${handle.id}`);
    consola.info("Monitor progress in the Trigger.dev dashboard:");
    consola.info(`  https://cloud.trigger.dev/runs/${handle.id}`);
  } catch (err) {
    consola.error("Failed to trigger backfill task:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  consola.error("Script failed:", err);
  process.exit(1);
});
