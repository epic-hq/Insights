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
import { Link } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"

export interface OrganizationTableRow {
	id: string
	name: string
	domain?: string | null
	industry?: string | null
	sizeRange?: string | null
	contacts: Array<{ id: string; name: string | null; segment?: string | null }>
	relationshipSignals: string[]
	updatedAt?: string | null
}

interface OrganizationsDataTableProps {
	rows: OrganizationTableRow[]
}

export function OrganizationsDataTable({ rows }: OrganizationsDataTableProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])

	const columns = useMemo<ColumnDef<OrganizationTableRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Organization",
				cell: ({ row }) => {
					const organization = row.original
					const domain = organization.domain?.replace?.(/^https?:\/\//, "")
					return (
						<div className="flex flex-col">
							<Link
								to={routes.organizations.detail(organization.id)}
								className="font-medium text-foreground transition-colors hover:text-primary"
							>
								{organization.name}
							</Link>
							{domain && <span className="text-muted-foreground text-xs">{domain}</span>}
						</div>
					)
				},
				enableSorting: true,
			},
			{
				accessorKey: "industry",
				header: "Focus",
				cell: ({ row }) => {
					const { industry, sizeRange } = row.original
					if (!industry && !sizeRange) {
						return <span className="text-muted-foreground text-xs">—</span>
					}
					return (
						<div className="flex flex-col text-foreground text-sm">
							{industry && <span>{industry}</span>}
							{sizeRange && <span className="text-muted-foreground text-xs">{sizeRange}</span>}
						</div>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: "contacts",
				header: "Active Contacts",
				cell: ({ row }) => {
					const contacts = row.original.contacts
					if (contacts.length === 0) {
						return <span className="text-muted-foreground text-xs">—</span>
					}
					const visible = contacts.slice(0, 3)
					const remaining = contacts.length - visible.length
					return (
						<div className="flex flex-wrap gap-1 text-sm">
							{visible.map((contact) => (
								<Link
									key={contact.id}
									to={routes.people.detail(contact.id)}
									className="rounded-full bg-muted px-2 py-0.5 text-foreground text-xs transition-colors hover:bg-primary/10 hover:text-primary"
								>
									{contact.name || "Unnamed"}
									{contact.segment ? <span className="ml-1 text-muted-foreground">({contact.segment})</span> : null}
								</Link>
							))}
							{remaining > 0 ? (
								<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
									+{remaining} more
								</span>
							) : null}
						</div>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: "relationshipSignals",
				header: "Relationship Signals",
				cell: ({ row }) => {
					const signals = row.original.relationshipSignals
					if (signals.length === 0) {
						return <span className="text-muted-foreground text-xs">—</span>
					}
					return (
						<div className="flex flex-wrap gap-1">
							{signals.map((signal) => (
								<Badge key={`${row.original.id}-${signal}`} variant="secondary">
									{signal}
								</Badge>
							))}
						</div>
					)
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
								No organizations found
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
