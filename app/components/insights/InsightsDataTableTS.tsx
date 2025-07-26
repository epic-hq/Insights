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
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import type { Insight } from "~/types"

interface InsightsDataTableProps {
	data: Insight[]
}

export function InsightsDataTable({ data }: InsightsDataTableProps) {
	const [globalFilter, setGlobalFilter] = useState("")
	const [sorting, setSorting] = useState<SortingState>([])
	const [columnFilters, setColumnFilters] = useState<any[]>([])

	const columns = useMemo<ColumnDef<Insight>[]>(
		() => [
			{
				accessorKey: "pain",
				header: () => "Pain",
				cell: (cell: CellContext<Insight, unknown>) => (
					<div className="font-medium">{cell.getValue() as string | null}</div>
				),
			},
			{
				accessorKey: "journey_stage",
				header: () => "Stage",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string | null
					return value ? <Badge variant="outline">{value}</Badge> : null
				},
			},
			{
				accessorKey: "persona",
				header: () => "Persona",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => {
					const value = cell.getValue() as string | null
					return value ? <Badge variant="outline">{value}</Badge> : null
				},
			},
			{
				accessorKey: "frequency",
				header: () => "Frequency",
				cell: (cell: CellContext<Insight, unknown>) => (
					<span className="text-sm">{cell.getValue() as string | null}</span>
				),
			},
			{
				accessorKey: "priority",
				header: () => "Priority",
				filterFn: "includesString",
				cell: (cell: CellContext<Insight, unknown>) => (
					<span className="font-semibold text-sm">{cell.getValue() as string | null}</span>
				),
			},
		],
		[]
	)

	const table = useReactTable({
		data,
		columns,
		state: {
			globalFilter,
			sorting,
			columnFilters,
		},
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: "includesString",
	})

	return (
		<div>
			<div className="mb-4">
				<Input
					placeholder="Search insights..."
					value={globalFilter}
					onChange={(e) => setGlobalFilter(e.target.value)}
					className="w-64"
				/>
			</div>

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
									const isFacet = ["journey_stage", "persona", "priority"].includes(colId)
									if (!isFacet) return <TableHead key={colId} />
									const uniqueValues = Array.from(
										new Set(data.map((row) => row[colId as keyof Insight]).filter(Boolean))
									)
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
														className={`rounded border px-2 py-1 text-xs ${filterValue === val ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 bg-white"}`}
														onClick={() => col?.setFilterValue(filterValue === val ? undefined : val)}
													>
														{String(val)}
													</button>
												))}
												{filterValue && (
													<button
														type="button"
														className="ml-2 rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs"
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
					{table.getRowModel().rows.map((row) => (
						<TableRow key={row.id}>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
