import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import InsightCardGrid from "~/features/insights/components/InsightCardGrid"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || ""
	const accountId = ctx_project.accountId || ""

	const { data: insights, error } = await getInsights({ supabase, accountId, projectId })
	if (error) throw new Response("Failed to load insights", { status: 500 })
	return { insights: insights || [], filters: { sort: null } }
}

export default function Cards() {
	const { insights, filters } = useLoaderData<typeof loader>()
	const [searchParams, setSearchParams] = useSearchParams()

	const updateSort = (sort: string) => {
		const newParams = new URLSearchParams(searchParams)
		newParams.set("sort", sort)
		setSearchParams(newParams)
	}

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<>
			<div className="mb-4 flex items-center justify-between">
				<div className="flex gap-2">
					<span className="text-gray-500 text-sm dark:text-gray-400">Sort by:</span>
					<select
						value={filters.sort || "default"}
						onChange={(e) => updateSort(e.target.value)}
						className="rounded border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<option value="default">Default</option>
						<option value="latest">Latest</option>
						<option value="impact">Impact</option>
						<option value="confidence">Confidence</option>
					</select>
				</div>
			</div>
			{insights.length > 0 ? (
				<InsightCardGrid insights={insights} />
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
