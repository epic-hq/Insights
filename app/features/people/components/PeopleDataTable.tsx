import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { Columns3 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export interface PersonTableRow {
	id: string
	name: string
	title?: string | null
	organization?: { id: string; name?: string | null } | null
	conversationCount: number
	evidenceCount: number
	stakeholderStatus?: string | null
	updatedAt?: string | null
}

interface PeopleDataTableProps {
	rows: PersonTableRow[]
}

export function PeopleDataTable({ rows }: PeopleDataTableProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])
	const storageKey = "people_table_columns_v1"

	const defaultColumnVisibility = useMemo<VisibilityState>(
		() => ({
			organization: true,
			title: true,
			conversationCount: true,
			evidenceCount: true,
			stakeholderStatus: true,
			updatedAt: false,
		}),
		[]
	)

	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
		if (typeof window === "undefined") return defaultColumnVisibility
		try {
			const raw = window.localStorage.getItem(storageKey)
			if (!raw) return defaultColumnVisibility
			const parsed = JSON.parse(raw) as unknown
			if (!parsed || typeof parsed !== "object") return defaultColumnVisibility
			return { ...defaultColumnVisibility, ...(parsed as VisibilityState) }
		} catch {
			return defaultColumnVisibility
		}
	})

	useEffect(() => {
		if (typeof window === "undefined") return
		window.localStorage.setItem(storageKey, JSON.stringify(columnVisibility))
	}, [columnVisibility])

	const columnLabels = useMemo<Record<string, string>>(
		() => ({
			organization: "Organization",
			title: "Title",
			conversationCount: "Conversations",
			evidenceCount: "Evidence",
			stakeholderStatus: "Stakeholder status",
			updatedAt: "Last updated",
		}),
		[]
	)

	const columns = useMemo<ColumnDef<PersonTableRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Person",
				cell: ({ row }) => {
					const person = row.original
					return (
						<Link to={routes.people.detail(person.id)} className="flex flex-col gap-1 text-left">
							<span className="flex items-center gap-2 font-medium text-foreground transition-colors hover:text-primary">
								{person.name}
							</span>
						</Link>
					)
				},
				enableSorting: true,
			},
			{
				accessorKey: "organization",
				header: "Organization",
				cell: ({ row }) => {
					const organization = row.original.organization
					if (!organization) return <span className="text-muted-foreground text-xs">—</span>
					return organization.id ? (
						<Link
							to={routes.organizations.detail(organization.id)}
							className="text-foreground text-sm transition-colors hover:text-primary"
						>
							{organization.name ?? "View organization"}
						</Link>
					) : (
						<span className="text-foreground text-sm">{organization.name}</span>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: "title",
				header: "Title",
				cell: ({ getValue }) => {
					const title = getValue<string | null | undefined>()
					if (!title) return <span className="text-muted-foreground text-xs">—</span>
					return <span className="text-foreground text-sm">{title}</span>
				},
				enableSorting: false,
			},
			{
				accessorKey: "conversationCount",
				header: "Conversations",
				cell: ({ getValue }) => <span className="font-medium text-sm">{getValue<number>()}</span>,
				enableSorting: true,
			},
			{
				accessorKey: "evidenceCount",
				header: "Evidence",
				cell: ({ getValue }) => <span className="font-medium text-sm">{getValue<number>()}</span>,
				enableSorting: true,
			},
			{
				accessorKey: "stakeholderStatus",
				header: "Stakeholder status",
				cell: ({ getValue }) => {
					const status = getValue<string | null | undefined>()
					if (!status) return <span className="text-muted-foreground text-xs">—</span>
					return <Badge variant="secondary">{status}</Badge>
				},
				enableSorting: false,
			},
			{
				accessorKey: "updatedAt",
				header: "Last Updated",
				cell: ({ getValue }) => {
					const updatedAt = getValue<string | null | undefined>()
					if (!updatedAt) return <span className="text-muted-foreground text-xs">—</span>
					return (
						<span className="text-muted-foreground text-xs">
							{formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
						</span>
					)
				},
				enableSorting: true,
				sortDescFirst: true,
				sortingFn: (a, b) => {
					const aValue = a.original.updatedAt ? new Date(a.original.updatedAt).getTime() : 0
					const bValue = b.original.updatedAt ? new Date(b.original.updatedAt).getTime() : 0
					return aValue - bValue
				},
			},
		],
		[routes.organizations, routes.people]
	)

	const table = useReactTable({
		data: rows,
		columns,
		state: { sorting, columnVisibility },
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	})

	return (
		<div className="space-y-3">
			<div className="flex justify-end">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="outline" size="sm">
							<Columns3 className="h-4 w-4" />
							Columns
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel>Visible columns</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{Object.keys(columnLabels).map((columnId) => {
							const column = table.getColumn(columnId)
							if (!column) return null
							return (
								<DropdownMenuCheckboxItem
									key={columnId}
									checked={column.getIsVisible()}
									onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
								>
									{columnLabels[columnId]}
								</DropdownMenuCheckboxItem>
							)
						})}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
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
								<TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center text-muted-foreground">
									No people found
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
		</div>
	)
}
