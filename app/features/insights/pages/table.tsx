import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import { InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || ""
	const accountId = ctx_project.accountId || ""

	const insights = await getInsights({ supabase, accountId, projectId })
	if (!insights) throw new Response("Failed to load insights", { status: 500 })
	return { insights: insights || [], filters: { sort: null } }
}

export default function Table() {
	const { insights: insightsResponse } = useLoaderData<typeof loader>()
	const insightsData = insightsResponse.data || []
	const [, setSearchParams] = useSearchParams()

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<>
			{insightsData.length > 0 ? (
				<InsightsDataTable data={insightsData} />
			) : (
				<div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
					<p className="text-gray-600 text-lg dark:text-gray-400">No insights match your current filters</p>
					<button type="button" onClick={clearFilters} className="mt-4 text-blue-600 hover:text-blue-800">
						Clear all filters
					</button>
				</div>
			)}
		</>
	)
}
