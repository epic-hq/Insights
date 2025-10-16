/**
 * Script to migrate array-based data to junction tables
 * Uses the same pattern as integration tests with proper Supabase access
 * Run with: npx tsx scripts/migrate-arrays.ts [status|migrate] [--dry-run]
 */

import consola from "consola"
import { getServerClient } from "~/lib/supabase/client.server"
import { getMigrationStatus, migrateArrayDataToJunctions } from "~/utils/migrateArrayData.server"

// Create a mock request object for server functions
function createMockRequest(): Request {
	// Use environment variables to create proper headers
	const headers = new Headers()
	headers.set("Content-Type", "application/json")

	// Add auth cookie if available (for local testing)
	if (process.env.TEST_AUTH_COOKIE) {
		headers.set("Cookie", process.env.TEST_AUTH_COOKIE)
	}

	return new Request("http://localhost:3000/migrate", {
		method: "POST",
		headers,
	})
}

async function main() {
	const args = process.argv.slice(2)
	const action = args[0] || "status"
	const dryRun = args.includes("--dry-run")

	consola.info(`Running migration script with action: ${action}`)
	consola.info(`Dry run: ${dryRun}`)

	try {
		const request = createMockRequest()

		// Use the same pattern as server-side loaders/actions
		const { client: supabase } = getServerClient(request)

		// Get account ID from the first project (same as integration tests)
		const { data: projects, error: projectError } = await supabase.from("projects").select("account_id").limit(1)

		if (projectError || !projects || projects.length === 0) {
			consola.error("Could not find any projects in the database:", projectError?.message)
			consola.error("Please ensure you have at least one project in your database")
			process.exit(1)
		}

		const accountId = projects[0].account_id

		consola.info(`Account ID: ${accountId}`)

		if (action === "status") {
			consola.info("Checking migration status...")
			const status = await getMigrationStatus(request, accountId)

			consola.info("Migration Status:")
			consola.info(`  Insights with related_tags: ${status.needsMigration.insightsWithTags}`)
			consola.info(`  Opportunities with related_insight_ids: ${status.needsMigration.opportunitiesWithInsights}`)
			consola.info(`  Total items needing migration: ${status.needsMigration.total}`)
			consola.info("")
			consola.info("Existing junction table records:")
			consola.info(`  Insight tags: ${status.existing.insightTags}`)
			consola.info(`  Opportunity insights: ${status.existing.opportunityInsights}`)
			consola.info(`  Total existing: ${status.existing.total}`)

			if (status.needsMigration.total === 0) {
				consola.success("No migration needed - all data is already normalized!")
			} else {
				consola.warn(`${status.needsMigration.total} items need migration`)
				consola.info('Run with "migrate" action to proceed')
			}
		}

		if (action === "migrate") {
			if (dryRun) {
				consola.info("DRY RUN - No changes will be made")
				const status = await getMigrationStatus(request, accountId)
				consola.info(`Would migrate ${status.needsMigration.total} items:`)
				consola.info(`  - ${status.needsMigration.insightsWithTags} insights with tags`)
				consola.info(`  - ${status.needsMigration.opportunitiesWithInsights} opportunities with insights`)
			} else {
				consola.info("Starting migration...")
				const stats = await migrateArrayDataToJunctions(request, accountId)

				consola.info("Migration Results:")
				consola.info(`  Insight tags migrated: ${stats.insightTagsMigrated}`)
				consola.info(`  Opportunity insights migrated: ${stats.opportunityInsightsMigrated}`)
				consola.info(`  Total processed: ${stats.totalProcessed}`)
				consola.info(`  Errors: ${stats.errors.length}`)

				if (stats.errors.length > 0) {
					consola.error("Migration errors:")
					for (const error of stats.errors) {
						consola.error(`  - ${error}`)
					}
				} else {
					consola.success("Migration completed successfully!")
				}
			}
		}
	} catch (error) {
		consola.error("Migration failed:", error)
		process.exit(1)
	}
}

// Show usage if no valid action provided
if (process.argv.length < 3 || !["status", "migrate"].includes(process.argv[2])) {
	consola.info("Usage:")
	consola.info("  npx tsx scripts/migrate-arrays.ts status")
	consola.info("  npx tsx scripts/migrate-arrays.ts migrate --dry-run")
	consola.info("  npx tsx scripts/migrate-arrays.ts migrate")
	consola.info("")
	consola.info("Environment variables required:")
	consola.info("  SUPABASE_URL - Your Supabase project URL")
	consola.info("  SUPABASE_ANON_KEY - Anon key for database access")
	consola.info("  Optional: TEST_AUTH_COOKIE - Auth cookie for testing")
	process.exit(1)
}

main().catch((error) => {
	consola.error("Script failed:", error)
	process.exit(1)
})
