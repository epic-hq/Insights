import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import { InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { userContext } from "~/server/user-context"

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const insights = await getInsights({ supabase, accountId })
	if (!insights) throw new Response("Failed to load insights", { status: 500 })
	return { insights: insights || [], filters: { sort: null } }
}

export default function Table() {
	const { insights } = useLoaderData<typeof loader>()
	const [, setSearchParams] = useSearchParams()

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<>
			{insights.length > 0 ? (
				<InsightsDataTable data={insights} />
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
