import type { MetaFunction } from "react-router"
import { Link, useLoaderData, useSearchParams } from "react-router-dom"
import type { Database } from "~/../supabase/types"
import InsightCardGrid from "~/components/insights/InsightCardGrid"
import type { InsightView } from "~/types"
import { db } from "~/utils/supabase.server"

export const meta: MetaFunction = () => {
	return [
		{ title: "Insights | Research Insights" },
		{ name: "description", content: "All research insights from interviews" },
	]
}

// Load insights from Supabase
export async function loader({ request }: { request: Request }) {
	const url = new URL(request.url)

	// Query params
	const sort = url.searchParams.get("sort") || "default"
	const interviewFilter = url.searchParams.get("interview") || null
	const themeFilter = url.searchParams.get("theme") || null
	const personaFilter = url.searchParams.get("persona") || null

	// Build base query
	type InsightRow = Database["public"]["Tables"]["insights"]["Row"]
	let query = db.from("insights").select("*")

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
	if (error) throw new Response(error.message, { status: 500 })

	// Map to component props
	const insights: InsightView[] = (rows || []).map((r: InsightRow) => ({
		id: r.id,
		name: r.name,
		tag: r.name,
		category: r.category,
		journeyStage: r.journey_stage ?? "",
		impact: r.impact ?? 0,
		novelty: r.novelty ?? 0,
		jtbd: r.jtbd ?? "",
		underlyingMotivation: r.motivation ?? "",
		pain: r.pain ?? "",
		desiredOutcome: r.desired_outcome ?? "",
		evidence: "", // TODO join quotes or join with related table
		opportunityIdeas: r.opportunity_ideas ?? [],
		confidence: r.confidence ?? "",
		createdAt: r.created_at,
		relatedTags: [],
	}))

	// Copy of results for additional in-memory filtering that is easier to do on the application side
	let filteredInsights = [...insights]

	// Filter by interview (not covered by DB query above because it is a partial match on the tag field)
	if (interviewFilter) {
		filteredInsights = filteredInsights.filter((insight) =>
			insight.name?.toLowerCase().includes(interviewFilter.toLowerCase())
		)
	}

	if (themeFilter) {
		filteredInsights = filteredInsights.filter((insight) =>
			insight.relatedTags?.some((tag: string) => tag.toLowerCase() === themeFilter.toLowerCase())
		)
	}

	if (personaFilter) {
		// For demo purposes, we'll just filter based on participant name containing the persona name
		// In a real app, you'd have more structured data about which insights relate to which personas
		filteredInsights = filteredInsights.filter((insight: InsightView) => {
			const personaName = personaFilter.toLowerCase()
			if (personaName === "students") {
				return insight.name?.toLowerCase().includes("student") || insight.name?.toLowerCase().includes("students")
			}
			if (personaName === "teachers") {
				return insight.name?.toLowerCase().includes("teacher") || insight.name?.toLowerCase().includes("teachers")
			}
			if (personaName === "admins") {
				return insight.name?.toLowerCase().includes("admin") || insight.name?.toLowerCase().includes("admins")
			}
			return false
		})
	}

	// Apply sorting
	if (sort === "latest") {
		filteredInsights.sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime())
	} else if (sort === "impact") {
		filteredInsights.sort((a: InsightView, b: InsightView) => Number(b.impact) - Number(a.impact))
	} else if (sort === "confidence") {
		filteredInsights.sort(
			(a: InsightView & { upvotes?: number }, b: InsightView & { upvotes?: number }) =>
				Number(b.upvotes || 0) - Number(a.upvotes || 0)
		)
	}

	return {
		insights: filteredInsights,
		filters: {
			sort,
			interviewFilter,
			themeFilter,
			personaFilter,
		},
		stats: {
			total: insights.length,
			filtered: filteredInsights.length,
		},
	}
}

export default function Insights() {
	const { insights, filters, stats } = useLoaderData<typeof loader>()
	const [searchParams, setSearchParams] = useSearchParams()

	const updateSort = (sort: string) => {
		searchParams.set("sort", sort)
		setSearchParams(searchParams)
	}

	const clearFilters = () => {
		setSearchParams({})
	}

	return (
		<div className="mx-auto max-w-[1440px] px-4 py-4">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-2xl">Insights</h1>
				<Link to="/" className="text-blue-600 hover:text-blue-800">
					Back to Dashboard
				</Link>
			</div>

			<div className="mb-6 rounded-lg bg-white p-6 shadow-sm dark:bg-gray-900">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-4">
					<div>
						<h2 className="font-semibold text-xl">Filters</h2>
						{(filters.interviewFilter || filters.themeFilter || filters.personaFilter) && (
							<div className="mt-2 flex flex-wrap gap-2">
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
					<div className="flex items-center gap-2">
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
				</div>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
						<p className="text-gray-500 text-sm dark:text-gray-400">Total Insights</p>
						<p className="font-bold text-2xl">
							{stats.filtered} / {stats.total}
						</p>
					</div>
				</div>
			</div>

			<div className="mb-6">
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
			</div>
		</div>
	)
}
