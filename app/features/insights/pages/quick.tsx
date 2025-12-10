import consola from "consola"
import { ChevronDown, ChevronRight, LayoutGrid, List, Search } from "lucide-react"
import { useMemo, useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Input } from "~/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

type ViewMode = "flat" | "grouped"

export const meta: MetaFunction = () => {
	return [{ title: "Quick Insights | Pain points" }, { name: "description", content: "Quick insights interface" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId ?? params.projectId ?? null
	const accountId = ctx_project.accountId ?? params.accountId ?? null

	if (!projectId || !accountId) {
		consola.warn("Missing project or account context")
		return { insights: [] }
	}

	const { data: insights, error } = await getInsights({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Insights query error:", error)
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${insights?.length || 0} insights`)

	return {
		insights: insights || [],
	}
}

// Group insights by category
function groupByCategory(insights: (Insight & Record<string, unknown>)[]) {
	const groups: Record<string, (Insight & Record<string, unknown>)[]> = {}
	const uncategorized: (Insight & Record<string, unknown>)[] = []

	for (const insight of insights) {
		const category = (insight as { category?: string }).category
		if (category) {
			if (!groups[category]) groups[category] = []
			groups[category].push(insight)
		} else {
			uncategorized.push(insight)
		}
	}

	// Sort categories alphabetically, put uncategorized at end
	const sortedCategories = Object.keys(groups).sort()
	const result: { category: string; insights: (Insight & Record<string, unknown>)[] }[] = sortedCategories.map(
		(category) => ({
			category,
			insights: groups[category],
		})
	)

	if (uncategorized.length > 0) {
		result.push({ category: "Uncategorized", insights: uncategorized })
	}

	return result
}

export default function QuickInsights() {
	const { insights } = useLoaderData<typeof loader>()
	const [searchQuery, setSearchQuery] = useState("")
	const [viewMode, setViewMode] = useState<ViewMode>("grouped")
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

	// Initialize all categories as expanded on first render
	const filtered = useMemo(() => {
		const normalized = searchQuery.trim().toLowerCase()
		if (!normalized) return insights

		return insights.filter((insight: Insight & Record<string, unknown>) => {
			const haystack = [
				insight.name,
				insight.statement,
				insight.inclusion_criteria,
				insight.exclusion_criteria,
				insight.synonyms,
				(insight.persona_insights as { personas?: { name?: string } }[] | undefined)
					?.map((pi) => pi.personas?.name)
					.join(" "),
				(insight.linked_themes as { name?: string }[] | undefined)?.map((theme) => theme.name).join(" "),
			]

			return haystack.some((text) => typeof text === "string" && text.toLowerCase().includes(normalized))
		})
	}, [insights, searchQuery])

	const grouped = useMemo(() => groupByCategory(filtered), [filtered])

	// Initialize expanded categories when grouped changes
	useMemo(() => {
		if (expandedCategories.size === 0 && grouped.length > 0) {
			setExpandedCategories(new Set(grouped.map((g) => g.category)))
		}
	}, [grouped, expandedCategories.size])

	const toggleCategory = (category: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev)
			if (next.has(category)) {
				next.delete(category)
			} else {
				next.add(category)
			}
			return next
		})
	}

	const expandAll = () => setExpandedCategories(new Set(grouped.map((g) => g.category)))
	const collapseAll = () => setExpandedCategories(new Set())

	return (
		<PageContainer className="space-y-6">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="relative w-full max-w-md">
					<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder="Search themes by name, statement, personas…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<ToggleGroup
						type="single"
						value={viewMode}
						onValueChange={(v) => v && setViewMode(v as ViewMode)}
						size="sm"
					>
						<ToggleGroupItem value="grouped" aria-label="Group by category">
							<List className="mr-1 h-4 w-4" />
							Grouped
						</ToggleGroupItem>
						<ToggleGroupItem value="flat" aria-label="Flat view">
							<LayoutGrid className="mr-1 h-4 w-4" />
							Flat
						</ToggleGroupItem>
					</ToggleGroup>
					{viewMode === "grouped" && (
						<div className="flex gap-1">
							<Button variant="ghost" size="sm" onClick={expandAll}>
								Expand All
							</Button>
							<Button variant="ghost" size="sm" onClick={collapseAll}>
								Collapse All
							</Button>
						</div>
					)}
				</div>
			</div>

			{filtered.length === 0 ? (
				<div className="rounded-lg border border-dashed bg-muted/30 py-16 text-center text-muted-foreground">
					<p className="font-medium">No insights match your filters</p>
					{searchQuery ? <p className="mt-2 text-sm">Try a different keyword or clear the search field.</p> : null}
				</div>
			) : viewMode === "flat" ? (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{filtered.map((insight) => (
						<InsightCardV3 key={insight.id} insight={insight} />
					))}
				</div>
			) : (
				<div className="space-y-4">
					{grouped.map(({ category, insights: categoryInsights }) => (
						<Collapsible
							key={category}
							open={expandedCategories.has(category)}
							onOpenChange={() => toggleCategory(category)}
						>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" className="flex w-full items-center justify-between p-2 hover:bg-muted/50">
									<div className="flex items-center gap-2">
										{expandedCategories.has(category) ? (
											<ChevronDown className="h-4 w-4" />
										) : (
											<ChevronRight className="h-4 w-4" />
										)}
										<span className="font-medium text-lg">{category}</span>
										<Badge variant="secondary" className="ml-2">
											{categoryInsights.length}
										</Badge>
									</div>
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{categoryInsights.map((insight) => (
										<InsightCardV3 key={insight.id} insight={insight} />
									))}
								</div>
							</CollapsibleContent>
						</Collapsible>
					))}
				</div>
			)}
		</PageContainer>
	)
}
