import type { ActionFunctionArgs } from "react-router"
import { Form, useActionData, useNavigation } from "react-router-dom"
import { getServerClient } from "~/lib/supabase/server"
import { getMigrationStatus, migrateArrayDataToJunctions } from "~/utils/migrateArrayData.server"

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const action = formData.get("action") as string
	const dryRun = formData.get("dryRun") === "true"

	try {
		// Get authenticated user and account ID using existing pattern
		const { client: supabase } = getServerClient(request)
		const { data: jwt } = await supabase.auth.getClaims()
		const accountId = jwt?.claims.sub

		if (!accountId) {
			return { error: "Not authenticated or no account ID found" }
		}

		if (action === "status") {
			const status = await getMigrationStatus(request, accountId)
			return { status, accountId }
		}

		if (action === "migrate") {
			if (dryRun) {
				const status = await getMigrationStatus(request, accountId)
				return {
					dryRun: true,
					status,
					accountId,
					message: `Would migrate ${status.needsMigration.total} items`,
				}
			}
			const stats = await migrateArrayDataToJunctions(request, accountId)
			return {
				migrationStats: stats,
				accountId,
				success: stats.errors.length === 0,
			}
		}

		return { error: "Invalid action" }
	} catch (error) {
		return { error: `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}` }
	}
}

export default function MigratePage() {
	const actionData = useActionData<typeof action>()
	const navigation = useNavigation()
	const isLoading = navigation.state === "submitting"

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-6 font-bold text-3xl">🔄 Array Data Migration</h1>

			<div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
				<p className="text-blue-800">This tool migrates array-based data to normalized junction tables:</p>
				<ul className="mt-2 list-inside list-disc text-blue-700">
					<li>
						<code>insights.related_tags</code> → <code>insight_tags</code> junction table
					</li>
					<li>
						<code>opportunities.related_insight_ids</code> → <code>opportunity_insights</code> junction table
					</li>
				</ul>
			</div>

			{/* Status Check */}
			<div className="mb-6 rounded-lg border bg-white p-6">
				<h2 className="mb-4 font-semibold text-xl">📊 Migration Status</h2>
				<Form method="post">
					<input type="hidden" name="action" value="status" />
					<button
						type="submit"
						disabled={isLoading}
						className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{isLoading ? "Checking..." : "Check Current Status"}
					</button>
				</Form>

				{actionData?.status && (
					<div className="mt-4 rounded bg-gray-50 p-4">
						<h3 className="mb-2 font-medium">Migration Status for Account: {actionData.accountId}</h3>
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<h4 className="font-medium text-red-600">Needs Migration:</h4>
								<ul className="list-inside list-disc">
									<li>Insights with tags: {actionData.status.needsMigration.insightsWithTags}</li>
									<li>Opportunities with insights: {actionData.status.needsMigration.opportunitiesWithInsights}</li>
									<li>
										<strong>Total: {actionData.status.needsMigration.total}</strong>
									</li>
								</ul>
							</div>
							<div>
								<h4 className="font-medium text-green-600">Already Migrated:</h4>
								<ul className="list-inside list-disc">
									<li>Insight tags: {actionData.status.existing.insightTags}</li>
									<li>Opportunity insights: {actionData.status.existing.opportunityInsights}</li>
									<li>
										<strong>Total: {actionData.status.existing.total}</strong>
									</li>
								</ul>
							</div>
						</div>

						{actionData.status.needsMigration.total === 0 ? (
							<div className="mt-4 rounded bg-green-100 p-3 text-green-800">
								✅ No migration needed - all data is already normalized!
							</div>
						) : (
							<div className="mt-4 rounded bg-yellow-100 p-3 text-yellow-800">
								⚠️ {actionData.status.needsMigration.total} items need migration
							</div>
						)}
					</div>
				)}
			</div>

			{/* Migration Actions */}
			<div className="rounded-lg border bg-white p-6">
				<h2 className="mb-4 font-semibold text-xl">🚀 Run Migration</h2>
				<p className="mb-4 text-gray-600">
					<strong>⚠️ Important:</strong> Always run a dry-run first to see what will be migrated!
				</p>

				<div className="flex gap-4">
					{/* Dry Run */}
					<Form method="post">
						<input type="hidden" name="action" value="migrate" />
						<input type="hidden" name="dryRun" value="true" />
						<button
							type="submit"
							disabled={isLoading}
							className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700 disabled:opacity-50"
						>
							{isLoading ? "Running..." : "🔍 Dry Run (Safe)"}
						</button>
					</Form>

					{/* Actual Migration */}
					<Form method="post">
						<input type="hidden" name="action" value="migrate" />
						<input type="hidden" name="dryRun" value="false" />
						<button
							type="submit"
							disabled={isLoading}
							className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
						>
							{isLoading ? "Migrating..." : "⚡ Run Migration"}
						</button>
					</Form>
				</div>

				{/* Results */}
				{actionData?.dryRun && (
					<div className="mt-4 rounded border border-yellow-200 bg-yellow-50 p-4">
						<h3 className="font-medium text-yellow-800">🔍 Dry Run Results</h3>
						<p className="text-yellow-700">{actionData.message}</p>
					</div>
				)}

				{actionData?.migrationStats && (
					<div
						className={`mt-4 rounded p-4 ${actionData.success ? "border border-green-200 bg-green-50" : "border border-red-200 bg-red-50"}`}
					>
						<h3 className={`font-medium ${actionData.success ? "text-green-800" : "text-red-800"}`}>
							{actionData.success ? "✅ Migration Completed!" : "❌ Migration Had Errors"}
						</h3>
						<div className="mt-2 text-sm">
							<p>Insight tags migrated: {actionData.migrationStats.insightTagsMigrated}</p>
							<p>Opportunity insights migrated: {actionData.migrationStats.opportunityInsightsMigrated}</p>
							<p>Total processed: {actionData.migrationStats.totalProcessed}</p>
							<p>Errors: {actionData.migrationStats.errors.length}</p>

							{actionData.migrationStats.errors.length > 0 && (
								<div className="mt-2">
									<h4 className="font-medium text-red-600">Errors:</h4>
									<ul className="list-inside list-disc text-red-600">
										{actionData.migrationStats.errors.map((error, i) => (
											<li key={i}>{error}</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				)}

				{actionData?.error && (
					<div className="mt-4 rounded border border-red-200 bg-red-50 p-4">
						<h3 className="font-medium text-red-800">❌ Error</h3>
						<p className="text-red-700">{actionData.error}</p>
					</div>
				)}
			</div>
		</div>
	)
}
