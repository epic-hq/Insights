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

export interface PersonTableRow {
	id: string
	name: string
	title?: string | null
	segment?: string | null
	persona?: { id: string; name: string } | null
	personaColor?: string | null
	organization?: { id: string; name?: string | null } | null
	interviewCount: number
	keySignals: string[]
	updatedAt?: string | null
}

interface PeopleDataTableProps {
	rows: PersonTableRow[]
}

export function PeopleDataTable({ rows }: PeopleDataTableProps) {
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")
	const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }])

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
								{person.personaColor ? (
									<span
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: person.personaColor }}
										aria-hidden="true"
									/>
								) : null}
								{person.name}
							</span>
							{(person.title || person.segment) && (
								<span className="text-muted-foreground text-xs">
									{[person.title, person.segment].filter(Boolean).join(" • ")}
								</span>
							)}
						</Link>
					)
				},
				enableSorting: true,
			},
			{
				accessorKey: "persona",
				header: "Primary Persona",
				cell: ({ row }) => {
					const persona = row.original.persona
					if (!persona) return <span className="text-muted-foreground text-xs">Unassigned</span>
					const color = row.original.personaColor
					return (
						<Badge
							variant="secondary"
							className="border px-2 py-0.5 font-medium text-xs"
							style={
								color
									? {
											backgroundColor: `${color}1a`,
											color,
											borderColor: color,
										}
									: undefined
							}
						>
							{persona.name}
						</Badge>
					)
				},
				enableSorting: false,
			},
			{
				accessorKey: "organization",
				header: "Key Organization",
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
				accessorKey: "keySignals",
				header: "Signals",
				cell: ({ row }) => {
					const signals = row.original.keySignals.slice(0, 3)
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
				accessorKey: "interviewCount",
				header: "Interviews",
				cell: ({ getValue }) => <span className="font-medium text-sm">{getValue<number>()}</span>,
				enableSorting: true,
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
	)
}
