import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import type { Database } from "~/types"

type Task = Database["public"]["Tables"]["tasks"]["Row"]

/**
 * Find and remove duplicate tasks across accounts
 * Keeps the task in the account that created it first (oldest created_at)
 */
export async function deduplicateTasks({
	supabase,
	dryRun = true,
}: {
	supabase: SupabaseClient<Database>
	dryRun?: boolean
}): Promise<{
	success: boolean
	duplicatesFound: number
	duplicatesRemoved: number
	errors: string[]
}> {
	const errors: string[] = []
	let duplicatesFound = 0
	let duplicatesRemoved = 0

	try {
		// Get all tasks
		const { data: allTasks, error: fetchError } = await supabase
			.from("tasks")
			.select("*")
			.order("created_at", { ascending: true })

		if (fetchError) {
			consola.error("Error fetching tasks:", fetchError)
			return { success: false, duplicatesFound: 0, duplicatesRemoved: 0, errors: [fetchError.message] }
		}

		if (!allTasks || allTasks.length === 0) {
			consola.info("No tasks found")
			return { success: true, duplicatesFound: 0, duplicatesRemoved: 0, errors: [] }
		}

		// Group tasks by title + cluster + project_id to find duplicates
		const taskGroups = new Map<string, Task[]>()

		for (const task of allTasks) {
			// Create a key that should be unique per task (ignoring account_id)
			const key = `${task.title}|${task.cluster}|${task.project_id}`
			const group = taskGroups.get(key) || []
			group.push(task)
			taskGroups.set(key, group)
		}

		// Find groups with multiple account_ids (duplicates)
		for (const [key, tasks] of taskGroups.entries()) {
			const uniqueAccounts = new Set(tasks.map((t) => t.account_id))

			if (uniqueAccounts.size > 1) {
				duplicatesFound += tasks.length - 1

				consola.warn(`Found duplicate task group: ${key}`)
				consola.warn(`  - ${tasks.length} copies across ${uniqueAccounts.size} accounts`)
				consola.warn(
					`  - Accounts: ${Array.from(uniqueAccounts)
						.map((id) => id.substring(0, 8))
						.join(", ")}`
				)

				// Keep the oldest task (first created), delete the rest
				const [keepTask, ...duplicates] = tasks

				consola.info(`  - Keeping task ${keepTask.id} (created ${keepTask.created_at})`)

				for (const duplicate of duplicates) {
					consola.warn(
						`  - ${dryRun ? "Would delete" : "Deleting"} task ${duplicate.id} from account ${duplicate.account_id.substring(0, 8)}`
					)

					if (!dryRun) {
						const { error: deleteError } = await supabase.from("tasks").delete().eq("id", duplicate.id)

						if (deleteError) {
							const errorMsg = `Failed to delete task ${duplicate.id}: ${deleteError.message}`
							consola.error(errorMsg)
							errors.push(errorMsg)
						} else {
							duplicatesRemoved++
						}
					}
				}
			}
		}

		if (dryRun) {
			consola.info(`\n[DRY RUN] Found ${duplicatesFound} duplicate tasks that would be removed`)
			consola.info("Run with dryRun=false to actually remove duplicates")
		} else {
			consola.success(`\nRemoved ${duplicatesRemoved} duplicate tasks`)
			if (errors.length > 0) {
				consola.warn(`Encountered ${errors.length} errors during cleanup`)
			}
		}

		return {
			success: errors.length === 0,
			duplicatesFound,
			duplicatesRemoved,
			errors,
		}
	} catch (error) {
		consola.error("Unexpected error during deduplication:", error)
		return {
			success: false,
			duplicatesFound,
			duplicatesRemoved,
			errors: [String(error)],
		}
	}
}
