import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import { InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || params.projectId || ""
	const accountId = ctx_project.accountId || params.accountId || ""

	if (!projectId || !accountId) {
		throw new Response("Missing project context", { status: 400 })
	}

	const { data, error } = await getInsights({ supabase, accountId, projectId })
	if (error) throw new Response("Failed to load insights", { status: 500 })
	return { insights: data || [] }
}

export default function Table() {
	const { insights } = useLoaderData<typeof loader>()
	const insightsData = insights || []
	const [, setSearchParams] = useSearchParams()

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<>
			{insightsData.length > 0 ? (
				<InsightsDataTable data={insightsData} />
			) : (
				<div className="rounded-lg bg-card p-8 text-center shadow-sm">
					<p className="text-lg text-muted-foreground">No insights match your current filters</p>
					<button type="button" onClick={clearFilters} className="mt-4 text-primary hover:underline">
						Clear all filters
					</button>
				</div>
			)}
		</>
	)
}
