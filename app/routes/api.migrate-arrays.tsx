/**
 * API route to migrate array-based data to normalized junction tables
 * POST /api/migrate-arrays
 */

import consola from "consola"
import type { ActionFunctionArgs } from "react-router"
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/server"
import { getMigrationStatus, migrateArrayDataToJunctions } from "~/utils/migrateArrayData.server"

export async function action({ request }: ActionFunctionArgs) {
	try {
		// User already authenticated by middleware, get from context instead of making API call
		const user = await getAuthenticatedUser(request)
		const { client: supabase } = getServerClient(request)

		if (!user) {
			consola.warn("Unauthorized migration attempt")
			return Response.json({ error: "Unauthorized" }, { status: 401 })
		}

		// Get account ID from user metadata
		const accountId = user.app_metadata?.claims?.sub
		if (!accountId) {
			consola.warn("No account ID found for user")
			return Response.json({ error: "Account not found" }, { status: 400 })
		}

		// Parse form data
		const formData = await request.formData()
		const action = formData.get("action")?.toString()
		const dryRun = formData.get("dryRun")?.toString() === "true"

		if (action === "status") {
			// Get migration status
			const status = await getMigrationStatus(request, accountId)
			return Response.json({
				success: true,
				status,
				message: `Found ${status.needsMigration.total} items that need migration, ${status.existing.total} already migrated`,
			})
		}

		if (action === "migrate") {
			if (dryRun) {
				// Dry run - just return what would be migrated
				const status = await getMigrationStatus(request, accountId)
				return Response.json({
					success: true,
					dryRun: true,
					wouldMigrate: status.needsMigration,
					message: `Would migrate ${status.needsMigration.total} items`,
				})
			}

			// Run actual migration
			consola.info(`Starting array-to-junction migration for account ${accountId}`)
			const stats = await migrateArrayDataToJunctions(request, accountId)

			if (stats.errors.length > 0) {
				consola.warn(`Migration completed with ${stats.errors.length} errors`)
				return Response.json({
					success: true,
					stats,
					message: `Migration completed: ${stats.totalProcessed} items migrated, ${stats.errors.length} errors`,
					hasErrors: true,
				})
			}

			consola.success(`Migration completed successfully: ${stats.totalProcessed} items migrated`)
			return Response.json({
				success: true,
				stats,
				message: `Migration completed successfully: ${stats.totalProcessed} items migrated`,
			})
		}

		return Response.json({ error: 'Invalid action. Use "status" or "migrate"' }, { status: 400 })
	} catch (error) {
		consola.error("Migration API error:", error)
		return Response.json(
			{
				error: "Migration failed",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		)
	}
}
