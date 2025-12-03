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
import React, { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight as BaseInsight } from "~/types"

// Extend Insight to include priority from the view
type Insight = BaseInsight & { priority: number }

interface InsightsDataTableProps {
	data: Insight[]
}

export function InsightsDataTable({ data }: InsightsDataTableProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	const [sorting, setSorting] = useState<SortingState>([{ id: "evidence_count", desc: true }])
	const [columnFilters, setColumnFilters] = useState<any[]>([])

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
				id: "statement",
				accessorFn: (row) => (row as any).statement || "—",
				header: () => "Statement",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string
					return value && value !== "—" ? (
						<div className="max-w-md truncate text-muted-foreground text-sm">{value}</div>
					) : (
						<span className="text-muted-foreground/60">—</span>
					)
				},
			},
			{
				id: "category",
				accessorFn: (row) => (row as any).category || "—",
				header: () => "Category",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string
					return value && value !== "—" ? (
						<Badge variant="secondary" className="text-xs">
							{value}
						</Badge>
					) : (
						<span className="text-muted-foreground/60">—</span>
					)
				},
			},
			{
				id: "pain",
				accessorFn: (row) => (row as any).pain || "—",
				header: () => "Pain",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string
					return value && value !== "—" ? (
						<div className="max-w-xs truncate text-muted-foreground text-sm">{value}</div>
					) : (
						<span className="text-muted-foreground/60">—</span>
					)
				},
			},
			{
				id: "jtbd",
				accessorFn: (row) => (row as any).jtbd || "—",
				header: () => "JTBD",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string
					return value && value !== "—" ? (
						<div className="max-w-xs truncate text-muted-foreground text-sm">{value}</div>
					) : (
						<span className="text-muted-foreground/60">—</span>
					)
				},
			},
			{
				id: "personas",
				header: () => "Personas",
				accessorFn: (row: any) =>
					(row.persona_insights ?? [])
						.map((pi: any) => pi.personas?.name)
						.filter(Boolean)
						.join(", "),
				cell: (cell: CellContext<Insight, unknown>) => {
					const personasStr = cell.getValue() as string
					const personas = personasStr ? personasStr.split(/,\s*/) : []
					return personas.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{personas.map((p) => (
								<Badge key={p} variant="outline">
									{p}
								</Badge>
							))}
						</div>
					) : null
				},
			},
			{
				accessorFn: (row: any) => row.evidence_count ?? 0,
				id: "evidence_count",
				header: () => "Evidence",
				cell: (cell: CellContext<Insight, unknown>) => {
					const count = cell.getValue() as number
					const insightId = cell.row.original.id
					return count > 0 ? (
						<Link to={routes.evidence.index() + `?theme_id=${insightId}`} className="hover:underline">
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
		[]
	)

	const table = useReactTable({
		data,
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

	return (
		<div>
			<Table>
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup, idx) => (
						<React.Fragment key={headerGroup.id}>
							<TableRow key={`${headerGroup.id}-header`}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										onClick={header.column.getToggleSortingHandler()}
										className="cursor-pointer select-none"
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
										{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
									</TableHead>
								))}
							</TableRow>
							<TableRow key={`${headerGroup.id}-filters`}>
								{headerGroup.headers.map((header) => {
									const colId = header.column.id
									const col = table.getColumn(colId)
									const isFacet = ["personas"].includes(colId)
									const isTextFilter = ["name", "statement"].includes(colId)
									if (!isFacet && !isTextFilter) return <TableHead key={colId} />

									// Handle text filters for Name and Statement columns
									if (isTextFilter) {
										const filterValue = col?.getFilterValue() as string | undefined
										const placeholder = colId === "name" ? "Filter themes..." : "Filter statement..."
										return (
											<TableHead key={colId}>
												<Input
													placeholder={placeholder}
													value={filterValue ?? ""}
													onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
													className="h-7 w-full text-xs"
												/>
											</TableHead>
										)
									}

									// Handle persona facet filter
									let uniqueValues: string[] = []
									if (colId === "personas") {
										uniqueValues = Array.from(
											new Set(
												data.flatMap((row: any) =>
													(row.persona_insights ?? []).map((pi: any) => pi.personas?.name).filter(Boolean)
												)
											)
										)
									}
									const filterValue = col?.getFilterValue() as string | undefined

									// Persona filter with buttons
									return (
										<TableHead key={colId}>
											<div className="flex flex-wrap gap-1">
												{uniqueValues.map((val) => (
													<button
														key={String(val)}
														type="button"
														className={`rounded border px-2 py-1 text-xs transition-colors ${
															filterValue === val
																? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-500"
																: "border-border bg-background text-foreground hover:bg-muted"
														}`}
														onClick={() => col?.setFilterValue(filterValue === val ? undefined : val)}
													>
														{String(val)}
													</button>
												))}
												{filterValue && (
													<button
														type="button"
														className="ml-2 rounded border border-border bg-muted px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/80"
														onClick={() => col?.setFilterValue(undefined)}
													>
														Clear
													</button>
												)}
											</div>
										</TableHead>
									)
								})}
							</TableRow>
						</React.Fragment>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => {
						// Extract ID safely with fallback
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
	)
}
