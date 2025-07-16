import { LayoutGrid, Table2, X } from "lucide-react"
import type { ReactElement } from "react"
import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import type { InsightView } from "~/types"
import InsightCardV2 from "./InsightCardV2"
import { InsightsDataTable } from "./insights-data-table"

interface InsightsListProps {
	insights: InsightView[]
	/** Optional unique id field for insights */
	getInsightId?: (insight: InsightView, index: number) => string
	title?: string
}

export default function InsightsList({
	insights = [],
	title = "Insights",
	getInsightId,
}: InsightsListProps): ReactElement {
	const [viewMode, setViewMode] = useState<"card" | "table">("card")
	const [activeFilter, setActiveFilter] = useState<string | null>(null)
	const location = useLocation()
	const navigate = useNavigate()

	// Read filter from URL on component mount
	useEffect(() => {
		const params = new URLSearchParams(location.search)
		const filter = params.get("filter")
		if (filter) {
			setActiveFilter(filter)
		}
	}, [location.search])

	// Update URL when filter changes
	const updateFilterInURL = (filter: string | null) => {
		const params = new URLSearchParams(location.search)
		if (filter) {
			params.set("filter", filter)
		} else {
			params.delete("filter")
		}
		navigate({ search: params.toString() })
	}

	// Handle tag click for filtering
	const handleTagClick = (tag: string) => {
		const newFilter = activeFilter === tag ? null : tag
		setActiveFilter(newFilter)
		updateFilterInURL(newFilter)
	}

	// Clear active filter
	const clearFilter = () => {
		setActiveFilter(null)
		updateFilterInURL(null)
	}

	// Filter insights based on active filter
	const filteredInsights = activeFilter
		? insights.filter((insight) => {
				return (
					insight.tag === activeFilter ||
					insight.category === activeFilter ||
					insight.relatedTags?.includes(activeFilter)
				)
			})
		: insights

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-2xl tracking-tight">{title}</h2>
				<div className="flex items-center gap-4">
					{activeFilter && (
						<Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
							<span>{activeFilter}</span>
							<button type="button" onClick={clearFilter} className="ml-1 rounded-full p-0.5 hover:bg-muted">
								<X className="h-3 w-3" />
							</button>
						</Badge>
					)}
					<Button variant="outline" size="sm" className="flex items-center gap-2">
						<svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
							<title>Export Data</title>
							<path
								fillRule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
								clipRule="evenodd"
							/>
						</svg>
						Add Insight
					</Button>
				</div>
			</div>

			<Tabs
				defaultValue="card"
				value={viewMode}
				onValueChange={(value: string) => setViewMode(value as "card" | "table")}
				className="w-full"
			>
				<TabsList className="grid w-[200px] grid-cols-2">
					<TabsTrigger value="card">
						<LayoutGrid className="mr-2 h-4 w-4" />
						Cards
					</TabsTrigger>
					<TabsTrigger value="table">
						<Table2 className="mr-2 h-4 w-4" />
						Table
					</TabsTrigger>
				</TabsList>

				<TabsContent value="card" className="mt-4">
					{filteredInsights.length === 0 ? (
						<Card>
							<CardContent className="flex flex-col items-center justify-center py-10">
								<div className="mb-3 rounded-full bg-muted p-3">
									<X className="h-6 w-6 text-muted-foreground" />
								</div>
								<h3 className="font-semibold text-lg">No insights found</h3>
								<p className="mt-2 max-w-sm text-center text-muted-foreground text-sm">
									{activeFilter
										? `No insights match the filter "${activeFilter}". Try a different filter.`
										: "There are no insights available. Create some insights to see them here."}
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{filteredInsights.map((insight, index) => {
								// Map InsightView properties to InsightCardV2 props
								const _cardProps = {
									id: insight.id,
									name: insight.name || insight.title || "Untitled Insight",
									category: insight.category,
									journeyStage: insight.journeyStage,
									jtbd: insight.jtbd,
									pain: insight.pain,
									desiredOutcome: insight.desiredOutcome,
									impact:
										typeof insight.impact === "string" ? Number.parseInt(insight.impact, 10) || 0 : insight.impact || 0,
									novelty: insight.novelty || 0,
									contradictions: insight.contradictions,
									opportunityIdeas: insight.opportunityIdeas || [],
									onTagClick: handleTagClick,
									onUpvote: () => {},
									onDownvote: () => {},
									onConvertToOpportunity: () => {},
									onArchive: () => {},
									onDontShowMe: () => {},
								}

								return (
									<Link
										key={getInsightId ? getInsightId(insight, index) : index}
										to={`/insights/${insight.id}`}
										className="no-underline hover:no-underline"
									>
										<InsightCardV2 insight={insight} />
									</Link>
								)
							})}
						</div>
					)}
				</TabsContent>

				<TabsContent value="table" className="mt-4">
					<InsightsDataTable insights={filteredInsights} />
				</TabsContent>
			</Tabs>
		</div>
	)
}
