import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { useMemo, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import type { ResearchLinkResponse } from "~/types"
import type { ResearchLinkQuestion } from "../schemas"
import { extractAnswer } from "../utils"

interface ResearchLinkResponsesDataTableProps {
	questions: ResearchLinkQuestion[]
	responses: ResearchLinkResponse[]
}

export function ResearchLinkResponsesDataTable({ questions, responses }: ResearchLinkResponsesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])

	const columns = useMemo<ColumnDef<ResearchLinkResponse>[]>(
		() => [
			{
				accessorKey: "email",
				header: "Email",
				cell: ({ getValue }) => {
					const email = getValue<string>()
					return (
						<a href={`mailto:${email}`} className="text-primary hover:underline">
							{email}
						</a>
					)
				},
			},
			...questions.map((question) => ({
				id: question.id,
				header: question.prompt,
				cell: ({ row }) => {
					const answer = extractAnswer(row.original, question)
					return answer ? (
						<span className="text-foreground text-sm">{answer}</span>
					) : (
						<span className="text-muted-foreground text-xs">—</span>
					)
				},
			})),
			{
				id: "createdAt",
				header: "Submitted",
				cell: ({ row }) => {
					const createdAt = row.original.created_at
					if (!createdAt) return <span className="text-muted-foreground text-xs">—</span>
					return (
						<span className="text-muted-foreground text-xs">
							{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
						</span>
					)
				},
				sortingFn: (a, b) => {
					const aTime = a.original.created_at ? new Date(a.original.created_at).getTime() : 0
					const bTime = b.original.created_at ? new Date(b.original.created_at).getTime() : 0
					return aTime - bTime
				},
			},
		],
		[questions]
	)

	const table = useReactTable({
		data: responses,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})

	return (
		<div className="overflow-hidden rounded-lg border bg-background">
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
									{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
								No responses yet
							</TableCell>
						</TableRow>
					) : (
						table.getRowModel().rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	)
}
