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
import { useMemo, useState } from "react"
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

	const [sorting, setSorting] = useState<SortingState>([{ id: "vote_count", desc: true }])
	const [columnFilters, setColumnFilters] = useState<any[]>([])

	const columns = useMemo<ColumnDef<Insight>[]>(
		() => [
			{
				id: "pain",
				accessorFn: (row) =>
					row.pain ||
					row.name ||
					(row as any).statement ||
					row.details ||
					row.jtbd ||
					row.desired_outcome ||
					"Untitled insight",
				header: () => "Pain",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => <div className="font-medium">{cell.getValue() as string}</div>,
			},
			{
				id: "journey_stage",
				accessorFn: (row) => row.journey_stage || row.category || "—",
				header: () => "Stage",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string | null
					return value && value !== "—" ? (
						<Badge variant="outline">{value}</Badge>
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
				id: "emotional_response",
				accessorKey: "emotional_response",
				header: () => "Emotion",
				cell: (cell: CellContext<Insight, unknown>) => {
					const emotion = cell.getValue() as string | null
					return emotion ? (
						<EmotionBadge emotion_string={emotion} muted />
					) : (
						<span className="text-muted-foreground/60">—</span>
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
					{table.getHeaderGroups().map((headerGroup) => (
						<>
							<TableRow key={headerGroup.id}>
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
							<TableRow>
								{headerGroup.headers.map((header) => {
									const colId = header.column.id
									const col = table.getColumn(colId)
									const isFacet = ["journey_stage", "personas"].includes(colId)
									const isTextFilter = colId === "pain"
									if (!isFacet && !isTextFilter) return <TableHead key={colId} />

									// Handle text filter for Pain column
									if (isTextFilter) {
										const filterValue = col?.getFilterValue() as string | undefined
										return (
											<TableHead key={colId}>
												<Input
													placeholder="Filter pain..."
													value={filterValue ?? ""}
													onChange={(e) => col?.setFilterValue(e.target.value || undefined)}
													className="h-7 w-full text-xs"
												/>
											</TableHead>
										)
									}

									let uniqueValues: string[] = []
									if (colId === "personas") {
										uniqueValues = Array.from(
											new Set(
												data.flatMap((row: any) =>
													(row.persona_insights ?? []).map((pi: any) => pi.personas?.name).filter(Boolean)
												)
											)
										)
									} else if (colId === "journey_stage") {
										uniqueValues = Array.from(
											new Set(
												data
													.map((row) => row.journey_stage || (row as any).category || null)
													.filter(Boolean) as string[]
											)
										)
										uniqueValues.unshift("—")
									} else {
										uniqueValues = Array.from(
											new Set(data.map((row) => row[colId as keyof Insight]).filter(Boolean) as string[])
										)
									}
									const filterValue = col?.getFilterValue() as string | undefined

									if (colId === "journey_stage") {
										return (
											<TableHead key={colId}>
												<Select
													value={filterValue ?? "__ALL__"}
													onValueChange={(val) => col?.setFilterValue(val === "__ALL__" ? undefined : val)}
												>
													<SelectTrigger className="h-7 w-32 text-xs">
														<SelectValue placeholder="All stages" />
													</SelectTrigger>
													<SelectContent>
														<SelectGroup>
															<SelectItem value="__ALL__">All stages</SelectItem>
															{uniqueValues.map((val) => (
																<SelectItem key={String(val)} value={String(val)}>
																	{String(val)}
																</SelectItem>
															))}
														</SelectGroup>
													</SelectContent>
												</Select>
											</TableHead>
										)
									}

									// Default: keep buttons for persona/priority
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
						</>
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
