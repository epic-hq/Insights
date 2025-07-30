import consola from "consola"
import { LayoutGrid, Rows } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData, useSearchParams } from "react-router-dom"
import { Button } from "~/components/ui/button"
import InsightCardGrid from "~/features/insights/components/InsightCardGrid"
import { InsightsDataTable } from "~/features/insights/components/InsightsDataTableTS"
import { getInsights } from "~/features/insights/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Insights | Insights" }, { name: "description", content: "View and manage all insights" }]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const _projectId = "" // TODO: Get project ID from context

	const insights = await getInsights({ supabase, accountId })

	if (!insights) {
		throw new Response("Failed to load insights", { status: 500 })
	}
	consola.log("Insights loaded:", insights)

	return { insights: insights || [], filters: {} }
}

export default function Insights() {
	const { insights, filters } = useLoaderData<typeof loader>()
	const [searchParams, setSearchParams] = useSearchParams()
	const [view, setView] = useState<"card" | "table">("table")

	const updateSort = (sort: string) => {
		searchParams.set("sort", sort)
		setSearchParams(searchParams)
	}

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<div className="w-full px-[5%]">
			<div className="mb-6 flex items-center justify-between">
				<div>
					{view === "card" && (
						<div className="flex gap-2">
							<span className="text-gray-500 text-sm dark:text-gray-400">Sort by:</span>
							<select
								value={filters.sort || "default"}
								onChange={(e) => updateSort(e.target.value)}
								className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
							>
								<option value="default">Default</option>
								<option value="latest">Latest</option>
								<option value="impact">Impact</option>
								<option value="confidence">Confidence</option>
							</select>
						</div>
					)}
				</div>
				<div className="flex items-center gap-4 rounded-md bg-gray-100 p-1 dark:bg-gray-800">
					<Button
						variant={view === "card" ? "default" : "ghost"}
						size="sm"
						onClick={() => setView("card")}
						className="p-2"
						title="Card view"
					>
						<LayoutGrid className="h-4 w-4" /> Table
					</Button>
					<Button
						variant={view === "table" ? "default" : "ghost"}
						size="sm"
						onClick={() => setView("table")}
						className="p-2"
						title="Table view"
					>
						<Rows className="h-4 w-4" /> Cards
					</Button>
				</div>
			</div>
			{insights.length > 0 ? (
				view === "card" ? (
					<InsightCardGrid insights={insights} />
				) : (
					<InsightsDataTable data={insights} />
				)
			) : (
				<div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
					<p className="text-gray-600 text-lg dark:text-gray-400">No insights match your current filters</p>
					<button type="button" onClick={clearFilters} className="mt-4 text-blue-600 hover:text-blue-800">
						Clear all filters
					</button>
				</div>
			)}

			{/*  */}
			<div className="mb-6">
				<Button className="m-6 p-6">
					<Link to="/insights/map">Insights Clustering (experimental)</Link>
				</Button>
			</div>
		</div>
	)
}
