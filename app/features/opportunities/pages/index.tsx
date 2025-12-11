import { addMonths, format, isSameMonth, startOfMonth } from "date-fns"
import { Briefcase, CalendarDays, Columns3 } from "lucide-react"
import { useMemo, useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOpportunities } from "~/features/opportunities/db"
import { loadOpportunityStages } from "~/features/opportunities/server/stage-settings.server"
import { ensureStageValue, normalizeStageId } from "~/features/opportunities/stage-config"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Opportunities" }, { name: "description", content: "Manage business opportunities" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: opportunities, error } = await getOpportunities({ supabase, accountId, projectId })

	if (error) {
		throw new Response("Error loading opportunities", { status: 500 })
	}

	const { stages } = await loadOpportunityStages({ supabase, accountId })

	return { opportunities: opportunities || [], stages }
}

type OpportunityRecord = Awaited<ReturnType<typeof loader>>["opportunities"][number]

const currencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
})

export default function OpportunitiesIndexPage() {
	const { opportunities, stages } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)
	const [viewMode, setViewMode] = useState<"stage" | "month">("stage")

	const totalAmount = useMemo(() => sumAmounts(opportunities), [opportunities])
	const averageDeal = useMemo(() => {
		const dealsWithAmount = opportunities.filter((o) => o.amount && Number(o.amount) > 0)
		return dealsWithAmount.length ? currencyFormatter.format(totalAmount / dealsWithAmount.length) : "—"
	}, [opportunities, totalAmount])

	const stageColumns = useMemo(() => {
		const defaultStageId = ensureStageValue(null, stages)
		const baseColumns = stages.map((stage) => {
			const deals = opportunities.filter(
				(opp) => normalizeStageId(opp.kanban_status || opp.stage || defaultStageId) === stage.id
			)
			return {
				key: stage.id,
				label: stage.label,
				description: stage.description,
				total: sumAmounts(deals),
				count: deals.length,
				deals,
			}
		})

		const uncategorized = opportunities.filter(
			(opp) => !stages.some((stage) => stage.id === normalizeStageId(opp.kanban_status || opp.stage || ""))
		)
		if (uncategorized.length > 0) {
			baseColumns.push({
				key: "Other",
				label: "Other",
				description: "Uncategorized",
				total: sumAmounts(uncategorized),
				count: uncategorized.length,
				deals: uncategorized,
			})
		}

		return baseColumns
	}, [opportunities, stages])

	const monthColumns = useMemo(() => {
		const start = startOfMonth(new Date())
		const months = Array.from({ length: 6 }, (_, index) => {
			const bucketStart = addMonths(start, index)
			const deals = opportunities.filter((opp) => {
				if (!opp.close_date) return false
				return isSameMonth(new Date(opp.close_date), bucketStart)
			})
			return {
				key: format(bucketStart, "yyyy-MM"),
				label: format(bucketStart, "MMM yyyy"),
				total: sumAmounts(deals),
				count: deals.length,
				deals,
			}
		})

		const noDateDeals = opportunities.filter((opp) => !opp.close_date)
		if (noDateDeals.length > 0) {
			months.push({
				key: "no-date",
				label: "No Date",
				total: sumAmounts(noDateDeals),
				count: noDateDeals.length,
				deals: noDateDeals,
			})
		}

		return months
	}, [opportunities])

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			<BackButton />
			<header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<div className="mb-3 flex items-center gap-3">
						<Briefcase className="h-8 w-8 text-primary" />
						<h1 className="text-balance font-bold text-4xl tracking-tight">Opportunities</h1>
					</div>

				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<ToggleGroup
						type="single"
						value={viewMode}
						onValueChange={(value) => value && setViewMode(value as typeof viewMode)}
						className="self-start"
					>
						<ToggleGroupItem value="stage" className="gap-2">
							<Columns3 className="h-4 w-4" /> Stage
						</ToggleGroupItem>
						<ToggleGroupItem value="month" className="gap-2">
							<CalendarDays className="h-4 w-4" /> Months
						</ToggleGroupItem>
					</ToggleGroup>
					<Button asChild>
						<Link to={routes.opportunities.new()}>Create Opportunity</Link>
					</Button>
				</div>
			</header>

			<section className="mb-6 grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<p className="text-muted-foreground text-sm">Total pipeline</p>
						<h2 className="font-bold text-3xl">{currencyFormatter.format(totalAmount)}</h2>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<p className="text-muted-foreground text-sm">Active deals</p>
						<h2 className="font-bold text-3xl">{opportunities.length}</h2>
					</CardHeader>
				</Card>
				<Card>
					<CardHeader>
						<p className="text-muted-foreground text-sm">Avg. deal size</p>
						<h2 className="font-bold text-3xl">{averageDeal}</h2>
					</CardHeader>
				</Card>
			</section>

			{opportunities.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Briefcase className="mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 font-semibold text-lg">No opportunities yet</h3>
						<p className="mb-4 text-center text-muted-foreground">
							Create your first opportunity to start forecasting revenue.
						</p>
						<Button asChild>
							<Link to={routes.opportunities.new()}>Create Opportunity</Link>
						</Button>
					</CardContent>
				</Card>
			) : viewMode === "stage" ? (
				<KanbanGrid columns={stageColumns} routes={routes} />
			) : (
				<KanbanGrid columns={monthColumns} routes={routes} emptyLabel="No deals scheduled" />
			)}
		</div>
	)
}

type KanbanColumn = {
	key: string
	label: string
	description?: string
	count: number
	total: number
	deals: OpportunityRecord[]
}

function KanbanGrid({
	columns,
	routes,
	emptyLabel = "No opportunities",
}: {
	columns: KanbanColumn[]
	routes: ReturnType<typeof useProjectRoutes>
	emptyLabel?: string
}) {
	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{columns.map((column) => (
				<Card key={column.key} className="flex h-full flex-col border-border/70">
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="font-semibold text-base">{column.label}</CardTitle>
								{column.description && <p className="text-muted-foreground text-xs">{column.description}</p>}
							</div>
							<div className="text-right">
								<p className="text-muted-foreground text-xs uppercase tracking-wide">Total</p>
								<p className="font-semibold">{currencyFormatter.format(column.total)}</p>
							</div>
						</div>
						<div className="text-muted-foreground text-xs">
							{column.count} deal{column.count === 1 ? "" : "s"}
						</div>
					</CardHeader>
					<CardContent className="flex flex-1 flex-col gap-3">
						{column.deals.length === 0 ? (
							<p className="rounded-md border border-border/60 border-dashed p-4 text-center text-muted-foreground text-sm">
								{emptyLabel}
							</p>
						) : (
							column.deals.map((deal) => <OpportunityCard key={deal.id} deal={deal} routes={routes} />)
						)}
					</CardContent>
				</Card>
			))}
		</div>
	)
}

function OpportunityCard({ deal, routes }: { deal: OpportunityRecord; routes: ReturnType<typeof useProjectRoutes> }) {
	return (
		<Link
			to={routes.opportunities.detail(deal.id)}
			className="group block rounded-lg border-2 border-border bg-card p-3 shadow-sm transition hover:border-primary/50 hover:shadow-md"
		>
			<div className="mb-1">
				<h3 className="font-semibold text-foreground text-sm leading-snug">{deal.title || "Untitled Opportunity"}</h3>
			</div>
			{deal.description && <p className="mb-2 line-clamp-2 text-muted-foreground text-xs">{deal.description}</p>}
			<div className="flex items-center justify-between text-xs">
				<div>
					<p className="text-muted-foreground">Value</p>
					<p className="font-semibold text-foreground">
						{deal.amount ? currencyFormatter.format(Number(deal.amount)) : "—"}
					</p>
				</div>
				<div className="text-right">
					<p className="text-muted-foreground">Close</p>
					<p className="font-semibold text-foreground">
						{deal.close_date ? format(new Date(deal.close_date), "MMM d, yyyy") : "—"}
					</p>
				</div>
			</div>
		</Link>
	)
}

function sumAmounts(items: OpportunityRecord[]) {
	return items.reduce((sum, item) => {
		const value = typeof item.amount === "number" ? item.amount : item.amount ? Number(item.amount) : 0
		return sum + (Number.isNaN(value) ? 0 : value)
	}, 0)
}
