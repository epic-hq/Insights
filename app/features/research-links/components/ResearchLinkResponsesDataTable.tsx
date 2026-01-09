/**
 * Enhanced data table for Ask link responses
 * Features: search, sort, column fitting, text wrap, person links
 */
import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { ArrowUpDown, ExternalLink, Search, User, Video } from "lucide-react"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import type { ResponseWithPerson } from "../db"
import type { ResearchLinkQuestion } from "../schemas"
import { extractAnswer } from "../utils"

interface ResearchLinkResponsesDataTableProps {
	questions: ResearchLinkQuestion[]
	responses: ResponseWithPerson[]
	basePath: string // e.g., /a/:accountId/:projectId
	listId: string
}

export function ResearchLinkResponsesDataTable({
	questions,
	responses,
	basePath,
	listId,
}: ResearchLinkResponsesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
	const [globalFilter, setGlobalFilter] = useState("")

	const columns = useMemo<ColumnDef<ResponseWithPerson>[]>(
		() => [
			{
				accessorKey: "email",
				header: ({ column }) => (
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Email
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ row }) => {
					const email = row.original.email
					const person = row.original.person
					return (
						<div className="flex items-center gap-2">
							<a href={`mailto:${email}`} className="truncate text-primary hover:underline">
								{email}
							</a>
							{person && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Link
											to={`${basePath}/people/${person.id}`}
											className="text-muted-foreground hover:text-foreground"
										>
											<User className="h-3.5 w-3.5" />
										</Link>
									</TooltipTrigger>
									<TooltipContent>View person: {person.name || email}</TooltipContent>
								</Tooltip>
							)}
						</div>
					)
				},
				size: 220,
			},
			...questions.map((question) => ({
				id: question.id,
				accessorFn: (row: ResponseWithPerson) => extractAnswer(row, question),
				header: ({ column }: { column: any }) => (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="-ml-3 h-8 max-w-[180px] truncate"
								onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
							>
								<span className="truncate">{question.prompt}</span>
								<ArrowUpDown className="ml-2 h-4 w-4 shrink-0" />
							</Button>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs">{question.prompt}</TooltipContent>
					</Tooltip>
				),
				cell: ({ getValue }: { getValue: () => unknown }) => {
					const answer = getValue() as string | null
					if (!answer) {
						return <span className="text-muted-foreground text-xs">—</span>
					}
					// Truncate long answers with tooltip
					const isLong = answer.length > 100
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className={`text-foreground text-sm ${isLong ? "line-clamp-2" : ""}`}>{answer}</span>
							</TooltipTrigger>
							{isLong && <TooltipContent className="max-w-md whitespace-pre-wrap">{answer}</TooltipContent>}
						</Tooltip>
					)
				},
				size: 200,
			})),
			{
				id: "video",
				accessorKey: "video_url",
				header: () => (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="flex items-center justify-center">
								<Video className="h-4 w-4 text-muted-foreground" />
							</span>
						</TooltipTrigger>
						<TooltipContent>Video Response</TooltipContent>
					</Tooltip>
				),
				cell: ({ getValue }) => {
					const videoUrl = getValue() as string | null
					if (!videoUrl) {
						return <span className="text-muted-foreground/40">—</span>
					}
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<Video className="h-4 w-4 text-primary" />
							</TooltipTrigger>
							<TooltipContent>Has video response</TooltipContent>
						</Tooltip>
					)
				},
				size: 50,
			},
			{
				id: "completed",
				accessorKey: "completed",
				header: "Status",
				cell: ({ getValue }) => {
					const completed = getValue() as boolean
					return (
						<span
							className={`rounded-full px-2 py-0.5 text-xs ${
								completed
									? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
									: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
							}`}
						>
							{completed ? "Complete" : "In progress"}
						</span>
					)
				},
				size: 100,
			},
			{
				id: "createdAt",
				accessorKey: "created_at",
				header: ({ column }) => (
					<Button
						variant="ghost"
						size="sm"
						className="-ml-3 h-8"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					>
						Submitted
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				),
				cell: ({ getValue }) => {
					const createdAt = getValue() as string | null
					if (!createdAt) {
						return <span className="text-muted-foreground text-xs">—</span>
					}
					return (
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="text-muted-foreground text-xs">
									{formatDistanceToNow(new Date(createdAt), {
										addSuffix: true,
									})}
								</span>
							</TooltipTrigger>
							<TooltipContent>{new Date(createdAt).toLocaleString()}</TooltipContent>
						</Tooltip>
					)
				},
				sortingFn: (a, b) => {
					const aTime = a.original.created_at ? new Date(a.original.created_at).getTime() : 0
					const bTime = b.original.created_at ? new Date(b.original.created_at).getTime() : 0
					return aTime - bTime
				},
				size: 120,
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }) => (
					<Link
						to={`${basePath}/ask/${listId}/responses/${row.original.id}`}
						className="text-muted-foreground hover:text-foreground"
					>
						<ExternalLink className="h-4 w-4" />
					</Link>
				),
				size: 40,
			},
		],
		[questions, basePath, listId]
	)

	const table = useReactTable({
		data: responses,
		columns,
		state: { sorting, columnFilters, globalFilter },
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		globalFilterFn: "includesString",
	})

	return (
		<div className="space-y-4">
			{/* Search */}
			<div className="flex items-center gap-4">
				<div className="relative max-w-sm flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search responses..."
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						className="pl-9"
					/>
				</div>
				<p className="text-muted-foreground text-sm">
					{table.getFilteredRowModel().rows.length} of {responses.length} responses
				</p>
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-lg border bg-background">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											style={{
												width: header.getSize(),
												minWidth: header.getSize(),
											}}
										>
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.length === 0 ? (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
										{globalFilter ? "No matching responses found" : "No responses yet"}
									</TableCell>
								</TableRow>
							) : (
								table.getRowModel().rows.map((row) => (
									<TableRow key={row.id} className="hover:bg-muted/50">
										{row.getVisibleCells().map((cell) => (
											<TableCell
												key={cell.id}
												style={{
													width: cell.column.getSize(),
													minWidth: cell.column.getSize(),
													maxWidth: cell.column.getSize(),
												}}
												className="overflow-hidden"
											>
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	)
}
