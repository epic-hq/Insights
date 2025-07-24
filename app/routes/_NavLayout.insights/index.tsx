import { LayoutGrid, Rows } from "lucide-react"
import { useState } from "react"
import type { MetaFunction } from "react-router"
import { useLoaderData, useSearchParams } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import { InsightsDataTable } from "~/components/insights/insights-data-table"
import { Button } from "~/components/ui/button"
import { getServerClient } from "~/lib/supabase/server"
import type { InsightView } from "~/types"

export const meta: MetaFunction = () => {
	return [
		{ title: "Insights | Research Insights" },
		{ name: "description", content: "All research insights from interviews" },
	]
}

// Load insights from Supabase
export async function loader({ request }: { request: Request }) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	const url = new URL(request.url)

	// Query params
	const sort = url.searchParams.get("sort") || "default"
	const interviewFilter = url.searchParams.get("interview") || null
	const themeFilter = url.searchParams.get("theme") || null
	const personaFilter = url.searchParams.get("persona") || null

	// Build base query with account filtering for RLS
	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]
	let query = supabase.from("insights").select("*").eq("account_id", accountId)

	// Apply filters (simple examples – adjust field names as needed)
	if (interviewFilter) {
		query = query.ilike("name", `%${interviewFilter}%`)
	}
	if (themeFilter) {
		query = query.ilike("category", `%${themeFilter}%`)
	}
	if (personaFilter) {
		query = query.ilike("persona", `%${personaFilter}%`) // assuming a persona column exists
	}

	// Sorting
	query = query.order(
		sort === "latest"
			? "created_at"
			: sort === "impact"
				? "impact"
				: sort === "confidence"
					? "confidence"
					: "created_at",
		{ ascending: false }
	)

	const { data: rows, error } = await query
	if (error) {
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	// Use Supabase types directly like interviews pattern
	const insights: InsightRow[] = rows || []

	// Apply additional in-memory filtering and sorting
	let filteredInsights = [...insights]

	// Filter by interview name
	if (interviewFilter) {
		filteredInsights = filteredInsights.filter((insight) =>
			insight.name?.toLowerCase().includes(interviewFilter.toLowerCase())
		)
	}

	// Apply sorting
	if (sort === "latest") {
		filteredInsights.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	} else if (sort === "impact") {
		filteredInsights.sort((a, b) => (b.impact || 0) - (a.impact || 0))
	} else if (sort === "confidence") {
		filteredInsights.sort((a, b) => {
			const aConf = typeof a.confidence === "string" ? Number.parseInt(a.confidence) || 0 : a.confidence || 0
			const bConf = typeof b.confidence === "string" ? Number.parseInt(b.confidence) || 0 : b.confidence || 0
			return bConf - aConf
		})
	}

	// Transform for UI components that expect InsightView format
	const transformedInsights: InsightView[] = filteredInsights.map((r: InsightRow) => ({
		id: r.id,
		name: r.name || "",
		category: r.category || "",
		journeyStage: r.journey_stage || "",
		impact: r.impact || 0,
		novelty: r.novelty || 0,
		jtbd: r.jtbd || "",
		underlyingMotivation: r.motivation || "",
		pain: r.pain || "",
		desiredOutcome: r.desired_outcome || "",
		evidence: r.evidence || "",
		opportunityIdeas: r.opportunity_ideas || [],
		confidence: r.confidence || "",
		createdAt: new Date(r.created_at),
		relatedTags: [],
		contradictions: r.contradictions || "",
		interview_id: r.interview_id,
	}))

	return {
		insights: transformedInsights,
		filters: {
			sort,
			interviewFilter,
			themeFilter,
			personaFilter,
		},
		stats: {
			total: insights.length,
		},
	}
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
				{view === "table" && (
					<div className="flex-1">
						{(filters.interviewFilter || filters.themeFilter || filters.personaFilter) && (
							<div className="flex flex-wrap gap-2">
								{filters.interviewFilter && (
									<div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-800 text-sm dark:bg-blue-900 dark:text-blue-300">
										<span>Interview: {filters.interviewFilter}</span>
										<button
											type="button"
											onClick={() => {
												searchParams.delete("interview")
												setSearchParams(searchParams)
											}}
											className="ml-1 hover:text-blue-600"
										>
											×
										</button>
									</div>
								)}
								{filters.themeFilter && (
									<div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-800 text-sm dark:bg-green-900 dark:text-green-300">
										<span>Theme: {filters.themeFilter}</span>
										<button
											type="button"
											onClick={() => {
												searchParams.delete("theme")
												setSearchParams(searchParams)
											}}
											className="ml-1 hover:text-green-600"
										>
											×
										</button>
									</div>
								)}
								{filters.personaFilter && (
									<div className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-purple-800 text-sm dark:bg-purple-900 dark:text-purple-300">
										<span>Persona: {filters.personaFilter}</span>
										<button
											type="button"
											onClick={() => {
												searchParams.delete("persona")
												setSearchParams(searchParams)
											}}
											className="ml-1 hover:text-purple-600"
										>
											×
										</button>
									</div>
								)}
								<button
									type="button"
									onClick={clearFilters}
									className="text-gray-600 text-sm hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
								>
									Clear all filters
								</button>
							</div>
						)}
					</div>
				)}

				<div className="flex w-full items-center justify-between">
					{view === "card" && (
						<div className="ml-auto flex items-center gap-2">
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

					<div className="flex items-center gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-800">
						<Button
							variant={view === "card" ? "default" : "ghost"}
							size="sm"
							onClick={() => setView("card")}
							className="h-8 w-8 p-0"
							title="Card view"
						>
							<LayoutGrid className="h-4 w-4" />
						</Button>
						<Button
							variant={view === "table" ? "default" : "ghost"}
							size="sm"
							onClick={() => setView("table")}
							className="h-8 w-8 p-0"
							title="Table view"
						>
							<Rows className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="mb-6">
				{insights.length > 0 ? (
					view === "card" ? (
						<InsightCardGrid insights={insights} />
					) : (
						<InsightsDataTable insights={insights} />
					)
				) : (
					<div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-gray-900">
						<p className="text-gray-600 text-lg dark:text-gray-400">No insights match your current filters</p>
						<button type="button" onClick={clearFilters} className="mt-4 text-blue-600 hover:text-blue-800">
							Clear all filters
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
