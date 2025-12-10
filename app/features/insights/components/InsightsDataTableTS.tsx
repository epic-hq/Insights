// InsightsDataTable.tsx

import {
	type CellContext,
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { ChevronDown, ChevronRight } from "lucide-react"
import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { Input } from "~/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight as BaseInsight } from "~/types"

// Extend Insight to include priority from the view
type Insight = BaseInsight & { priority: number }

interface InsightsDataTableProps {
	data: Insight[]
}

type ViewMode = "flat" | "grouped"

// Group insights by category
function groupByCategory(insights: Insight[]) {
	const groups: Record<string, Insight[]> = {}
	const uncategorized: Insight[] = []

	for (const insight of insights) {
		const category = (insight as any).category
		if (category) {
			if (!groups[category]) groups[category] = []
			groups[category].push(insight)
		} else {
			uncategorized.push(insight)
		}
	}

	// Sort categories alphabetically, put uncategorized at end
	const sortedCategories = Object.keys(groups).sort()
	const result: { category: string; insights: Insight[] }[] = sortedCategories.map((category) => ({
		category,
		insights: groups[category],
	}))

	if (uncategorized.length > 0) {
		result.push({ category: "Uncategorized", insights: uncategorized })
	}

	return result
}

export function InsightsDataTable({ data }: InsightsDataTableProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const [sorting, setSorting] = useState<SortingState>([{ id: "evidence_count", desc: true }])
	const [columnFilters, setColumnFilters] = useState<any[]>([])
	const [viewMode, setViewMode] = useState<ViewMode>("grouped")
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
	const [filterValue, setFilterValue] = useState("")

	// Filter data based on search
	const filteredData = useMemo(() => {
		if (!filterValue.trim()) return data
		const normalized = filterValue.trim().toLowerCase()
		return data.filter((insight) => {
			const haystack = [insight.name, (insight as any).statement, (insight as any).category]
			return haystack.some((text) => typeof text === "string" && text.toLowerCase().includes(normalized))
		})
	}, [data, filterValue])

	// Group filtered data
	const grouped = useMemo(() => groupByCategory(filteredData), [filteredData])

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

	const columns = useMemo<ColumnDef<Insight>[]>(
		() => [
			{
				id: "name",
				accessorFn: (row) => row.name || "Untitled theme",
				header: () => "Theme Name",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => <div className="font-medium">{cell.getValue() as string}</div>,
			},
			{
				accessorFn: (row: any) => row.evidence_count ?? 0,
				id: "evidence_count",
				header: () => "Evidence",
				cell: (cell: CellContext<Insight, unknown>) => {
					const count = cell.getValue() as number
					const insightId = cell.row.original.id
					return count > 0 ? (
						<Link to={`${routes.evidence.index()}?theme_id=${insightId}`} className="hover:underline">
							<span className="font-semibold text-sm">{count}</span>
						</Link>
					) : (
						<span className="text-muted-foreground text-sm">0</span>
					)
				},
			},
			{
				accessorFn: (row) => row.vote_count ?? 0,
				id: "vote_count",
				header: () => "Votes",
				cell: (cell: CellContext<Insight, unknown>) => (
					<span className="font-semibold text-sm">{cell.getValue() as number}</span>
				),
			},
		],
		[routes.evidence]
	)

	const table = useReactTable({
		data: filteredData,
		columns,
		state: {
			sorting,
			columnFilters,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
	})

	// Render a single table for a category group
	const renderCategoryTable = (insights: Insight[]) => {
		// Sort insights by evidence_count desc
		const sortedInsights = [...insights].sort((a, b) => ((b as any).evidence_count ?? 0) - ((a as any).evidence_count ?? 0))

		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-[50%]">Theme Name</TableHead>
						<TableHead className="w-[25%]">Evidence</TableHead>
						<TableHead className="w-[25%]">Votes</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sortedInsights.map((insight) => (
						<TableRow key={insight.id}>
							<TableCell>
								<Link to={routes.insights.detail(insight.id)} className="font-medium hover:underline">
									{insight.name || "Untitled theme"}
								</Link>
							</TableCell>
							<TableCell>
								{(insight as any).evidence_count > 0 ? (
									<Link to={`${routes.evidence.index()}?theme_id=${insight.id}`} className="hover:underline">
										<span className="font-semibold text-sm">{(insight as any).evidence_count}</span>
									</Link>
								) : (
									<span className="text-muted-foreground text-sm">0</span>
								)}
							</TableCell>
							<TableCell>
								<span className="font-semibold text-sm">{(insight as any).vote_count ?? 0}</span>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		)
	}

	return (
		<div className="space-y-4">
			{/* Controls */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<Input
					placeholder="Filter themes by name, statement..."
					value={filterValue}
					onChange={(e) => setFilterValue(e.target.value)}
					className="max-w-sm"
				/>
				<div className="flex items-center gap-2">
					<Button
						variant={viewMode === "grouped" ? "secondary" : "ghost"}
						size="sm"
						onClick={() => setViewMode("grouped")}
					>
						Grouped
					</Button>
					<Button variant={viewMode === "flat" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("flat")}>
						Flat
					</Button>
					{viewMode === "grouped" && (
						<>
							<Button variant="ghost" size="sm" onClick={expandAll}>
								Expand All
							</Button>
							<Button variant="ghost" size="sm" onClick={collapseAll}>
								Collapse All
							</Button>
						</>
					)}
				</div>
			</div>

			{/* Grouped View */}
			{viewMode === "grouped" ? (
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
								<div className="mt-2 rounded-md border">{renderCategoryTable(categoryInsights)}</div>
							</CollapsibleContent>
						</Collapsible>
					))}
				</div>
			) : (
				/* Flat View */
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											onClick={header.column.getToggleSortingHandler()}
											className="cursor-pointer select-none"
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
											{header.column.getIsSorted() === "asc"
												? " ↑"
												: header.column.getIsSorted() === "desc"
													? " ↓"
													: ""}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => {
								const insightId = row.original?.id
								return (
									<TableRow key={row.id}>
										{row.getVisibleCells().map((cell, i) => (
											<TableCell key={cell.id}>
												{i === 0 && insightId ? (
													<Link to={routes.insights.detail(insightId)}>
														{flexRender(cell.column.columnDef.cell, cell.getContext())}
													</Link>
												) : (
													flexRender(cell.column.columnDef.cell, cell.getContext())
												)}
											</TableCell>
										))}
									</TableRow>
								)
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	)
}
