import type { LucideIcon } from "lucide-react"
import {
	AlignLeft,
	BarChart3,
	Box,
	Boxes,
	Heart,
	Image,
	Layers,
	PersonStanding,
	Settings,
	Sparkles,
	Target,
	Users,
	Wrench,
	X,
} from "lucide-react"
import { useFetcher } from "react-router-dom"
import { AddFacetSignalDialog } from "~/components/dialogs/AddFacetSignalDialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import { InlineEditableFacetSummary } from "./InlineEditableFacetSummary"

type FacetEntry = {
	facet_account_id: number
	label: string
	source: string | null
	confidence: number | null
	kind_slug: string
}

type FacetGroupLens = {
	kind_slug: string
	label: string
	summary?: string | null
	facets: FacetEntry[]
}

type AvailableFacet = {
	id: number
	label: string
	slug: string
}

type PersonFacetLensesProps = {
	groups: FacetGroupLens[]
	personId: string
	availableFacetsByKind?: Record<string, AvailableFacet[]>
	isGenerating?: boolean
}

const KIND_ICON_MAP: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
	pain: { icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
	goal: { icon: Target, color: "text-emerald-700", bg: "bg-emerald-50" },
	workflow: { icon: Layers, color: "text-amber-700", bg: "bg-amber-50" },
	task: { icon: BarChart3, color: "text-blue-700", bg: "bg-blue-50" },
	demographic: { icon: Users, color: "text-slate-700", bg: "bg-slate-100" },
	preference: { icon: AlignLeft, color: "text-indigo-700", bg: "bg-indigo-50" },
	artifact: { icon: Box, color: "text-purple-700", bg: "bg-purple-50" },
	tool: { icon: Wrench, color: "text-cyan-700", bg: "bg-cyan-50" },
	behavior: { icon: PersonStanding, color: "text-orange-700", bg: "bg-orange-50" },
	context: { icon: Image, color: "text-teal-700", bg: "bg-teal-50" },
	job_function: { icon: Boxes, color: "text-violet-700", bg: "bg-violet-50" },
}

function getIcon(kindSlug: string) {
	return KIND_ICON_MAP[kindSlug] ?? { icon: Sparkles, color: "text-slate-700", bg: "bg-slate-100" }
}

function confidenceIcon(confidence: number | null) {
	if (confidence === null || confidence === undefined) return null

	// High confidence (>= 0.7): 3 bars
	if (confidence >= 0.7) {
		return (
			<div className="flex items-end gap-0.5" title="High confidence">
				<div className="h-2.5 w-1 rounded-sm bg-emerald-600" />
				<div className="h-3 w-1 rounded-sm bg-emerald-600" />
				<div className="h-3.5 w-1 rounded-sm bg-emerald-600" />
			</div>
		)
	}

	// Medium confidence (>= 0.4): 2 bars
	if (confidence >= 0.4) {
		return (
			<div className="flex items-end gap-0.5" title="Medium confidence">
				<div className="h-2.5 w-1 rounded-sm bg-amber-600" />
				<div className="h-3 w-1 rounded-sm bg-amber-600" />
				<div className="h-3.5 w-1 rounded-sm bg-muted-foreground/30" />
			</div>
		)
	}

	// Low confidence: 1 bar
	return (
		<div className="flex items-end gap-0.5" title="Low confidence">
			<div className="h-2.5 w-1 rounded-sm bg-rose-600" />
			<div className="h-3 w-1 rounded-sm bg-muted-foreground/30" />
			<div className="h-3.5 w-1 rounded-sm bg-muted-foreground/30" />
		</div>
	)
}

function fallbackSummary(facets: FacetEntry[]) {
	if (!facets?.length) return "No attributes captured yet."
	const labels = facets
		.map((facet) => facet.label)
		.filter(Boolean)
		.slice(0, 3)
	return labels.join(" • ") || "No attributes captured yet."
}

export function PersonFacetLenses({
	groups,
	personId,
	availableFacetsByKind = {},
	isGenerating,
}: PersonFacetLensesProps) {
	const fetcher = useFetcher()

	if (!groups.length) return null

	const defaultAccordionValue = groups[0]?.kind_slug

	const handleRemoveFacet = (facetAccountId: number) => {
		fetcher.submit(
			{
				_action: "remove-facet-signal",
				person_id: personId,
				facet_account_id: facetAccountId.toString(),
			},
			{ method: "post" }
		)
	}

	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<div className="space-y-1">
					<h2 className="font-semibold text-foreground text-lg">Attribute lenses</h2>
					<p className="text-muted-foreground text-sm">Headline takeaways per facet group, details inside.</p>
				</div>
				{isGenerating ? (
					<Badge variant="outline" className="text-[0.65rem] uppercase">
						Refreshing
					</Badge>
				) : null}
			</div>

			<Accordion type="single" collapsible defaultValue={defaultAccordionValue} className="mx-auto max-w-3xl space-y-3">
				{groups.map((group) => {
					const iconConfig = getIcon(group.kind_slug)
					const summaryText = group.summary?.trim() || fallbackSummary(group.facets)
					const availableFacets = availableFacetsByKind[group.kind_slug] || []
					// Filter out facets that are already linked to this person
					const linkedFacetIds = new Set(group.facets.map((f) => f.facet_account_id))
					const unlinkedFacets = availableFacets.filter((f) => !linkedFacetIds.has(f.id))
					// Sort facets by confidence (highest first)
					const sortedFacets = [...group.facets].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))

					return (
						<AccordionItem
							value={group.kind_slug}
							key={group.kind_slug}
							className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm"
						>
							<AccordionTrigger className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:no-underline">
								<div className={cn("flex h-9 w-9 items-center justify-center rounded-full", iconConfig.bg)}>
									<iconConfig.icon className={cn("h-4 w-4", iconConfig.color)} />
								</div>
								<div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
									<span className="font-semibold text-foreground text-sm capitalize">{group.label}</span>
									<div className="flex-1 text-left text-foreground/70 text-sm group-data-[state=closed]:line-clamp-2">
										<InlineEditableFacetSummary
											value={group.summary}
											personId={personId}
											kindSlug={group.kind_slug}
											placeholder={fallbackSummary(group.facets)}
											className="text-foreground/70"
										/>
									</div>
								</div>
							</AccordionTrigger>
							<AccordionContent className="space-y-3 px-4 pb-4">
								<div className="rounded-lg border border-border/60 border-dashed bg-muted/10 p-3">
									<div className="mb-2 flex items-center justify-between">
										<p className="text-muted-foreground text-xs uppercase tracking-wide">Signals</p>
										<AddFacetSignalDialog
											personId={personId}
											kindSlug={group.kind_slug}
											kindLabel={group.label}
											availableFacets={unlinkedFacets}
										/>
									</div>
									<div className="flex flex-wrap gap-2">
										{sortedFacets.length === 0 ? (
											<p className="text-muted-foreground text-xs italic">No signals yet. Add one to get started.</p>
										) : (
											sortedFacets.map((facet) => (
												<Badge
													key={facet.facet_account_id}
													variant="secondary"
													className="flex items-center gap-2 pr-1 text-xs leading-tight"
												>
													<span>{facet.label}</span>
													{confidenceIcon(facet.confidence)}
													<Button
														type="button"
														onClick={() => handleRemoveFacet(facet.facet_account_id)}
														variant="ghost"
														size="icon"
														className="h-4 w-4 p-0 hover:bg-transparent"
														title="Remove signal"
														disabled={fetcher.state !== "idle"}
													>
														<X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
													</Button>
												</Badge>
											))
										)}
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					)
				})}
			</Accordion>
		</section>
	)
}
