import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useCurrentProject } from "~/contexts/current-project-context";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";

export interface PersonaTableRow {
	id: string;
	name: string;
	kind?: string | null;
	tags: string[];
	goals: string[];
	pains: string[];
	linkedPeople: number;
	updatedAt?: string | null;
	colorHex?: string | null;
}

interface PersonasDataTableProps {
	rows: PersonaTableRow[];
}

export function PersonasDataTable({ rows }: PersonasDataTableProps) {
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");
	const [sorting, setSorting] = useState<SortingState>([{ id: "linkedPeople", desc: true }]);

	const columns = useMemo<ColumnDef<PersonaTableRow>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Persona",
				cell: ({ row }) => {
					const persona = row.original;
					return (
						<div className="flex flex-col gap-1">
							<Link
								to={routes.personas.detail(persona.id)}
								className="flex items-center gap-2 font-medium text-foreground transition-colors hover:text-primary"
							>
								{persona.colorHex ? (
									<span
										className="h-2.5 w-2.5 rounded-full"
										style={{ backgroundColor: persona.colorHex }}
										aria-hidden="true"
									/>
								) : null}
								{persona.name}
							</Link>
							<div className="flex flex-wrap items-center gap-1">
								{persona.kind ? (
									<Badge
										variant="secondary"
										className="border px-2 py-0.5 text-xs capitalize"
										style={
											persona.colorHex
												? {
														backgroundColor: `${persona.colorHex}1a`,
														color: persona.colorHex,
														borderColor: persona.colorHex,
													}
												: undefined
										}
									>
										{persona.kind}
									</Badge>
								) : null}
								{persona.tags.slice(0, 2).map((tag) => (
									<Badge key={`${persona.id}-${tag}`} variant="secondary" className="text-xs">
										{tag}
									</Badge>
								))}
								{persona.tags.length > 2 ? (
									<span className="text-[10px] text-foreground/60">+{persona.tags.length - 2} more</span>
								) : null}
							</div>
						</div>
					);
				},
				enableSorting: true,
			},
			{
				accessorKey: "goals",
				header: "Primary Goals",
				cell: ({ row }) => {
					const goals = row.original.goals.slice(0, 3);
					if (goals.length === 0) {
						return <span className="text-muted-foreground text-xs">—</span>;
					}
					return (
						<ul className="list-inside list-disc space-y-1 text-sm">
							{goals.map((goal, index) => (
								<li key={`${row.original.id}-goal-${index}`} className="text-foreground">
									{goal}
								</li>
							))}
						</ul>
					);
				},
				enableSorting: false,
			},
			{
				accessorKey: "pains",
				header: "Pain Points",
				cell: ({ row }) => {
					const pains = row.original.pains.slice(0, 3);
					if (pains.length === 0) {
						return <span className="text-muted-foreground text-xs">—</span>;
					}
					return (
						<ul className="list-inside list-disc space-y-1 text-sm">
							{pains.map((pain, index) => (
								<li key={`${row.original.id}-pain-${index}`} className="text-foreground">
									{pain}
								</li>
							))}
						</ul>
					);
				},
				enableSorting: false,
			},
			{
				accessorKey: "linkedPeople",
				header: "Linked People",
				cell: ({ getValue }) => <span className="font-medium text-foreground text-sm">{getValue<number>()}</span>,
				enableSorting: true,
			},
			{
				accessorKey: "updatedAt",
				header: "Last Updated",
				cell: ({ getValue }) => {
					const updatedAt = getValue<string | null | undefined>();
					if (!updatedAt) return <span className="text-muted-foreground text-xs">—</span>;
					return (
						<span className="text-muted-foreground text-xs">
							{formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
						</span>
					);
				},
				enableSorting: true,
				sortDescFirst: true,
				sortingFn: (a, b) => {
					const aValue = a.original.updatedAt ? new Date(a.original.updatedAt).getTime() : 0;
					const bValue = b.original.updatedAt ? new Date(b.original.updatedAt).getTime() : 0;
					return aValue - bValue;
				},
			},
		],
		[routes.personas]
	);

	const table = useReactTable({
		data: rows,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

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
								No personas found
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
	);
}
