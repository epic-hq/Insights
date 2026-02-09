/**
 * ICPScoredPeopleTable - TanStack data table for ICP scored people
 *
 * Sortable table showing name, title, company, score, and status.
 * Yellow highlights on missing title/company cells signal data gaps.
 * Row click opens the edit drawer — no separate edit/data columns needed.
 */

import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { ICPScoredPerson } from "./AnalysisByPersonTab";
import { BandBadge } from "./ICPMatchSection";

type ICPScoredPeopleTableProps = {
	people: ICPScoredPerson[];
	projectPath: string;
	onEditPerson: (person: ICPScoredPerson) => void;
};

export function ICPScoredPeopleTable({ people, projectPath, onEditPerson }: ICPScoredPeopleTableProps) {
	const routes = useProjectRoutes(projectPath);

	const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);

	const columns = useMemo<ColumnDef<ICPScoredPerson>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				cell: ({ row }) => (
					<Link
						to={routes.people.detail(row.original.person_id)}
						className="block truncate font-medium text-sm hover:underline"
						title={row.original.name}
						onClick={(e) => e.stopPropagation()}
					>
						{row.original.name}
					</Link>
				),
				enableSorting: true,
			},
			{
				accessorKey: "title",
				header: "Title",
				cell: ({ row }) => {
					const val = row.original.title;
					if (!val) {
						return (
							<span className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
								—
							</span>
						);
					}
					return (
						<span className="block truncate text-foreground/70 text-xs" title={val}>
							{val}
						</span>
					);
				},
				enableSorting: false,
			},
			{
				id: "company",
				header: "Company",
				cell: ({ row }) => {
					const val = row.original.org_name || row.original.company;
					if (!val) {
						return (
							<span className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
								—
							</span>
						);
					}
					return (
						<span className="block truncate text-foreground/70 text-xs" title={val}>
							{val}
						</span>
					);
				},
				enableSorting: false,
			},
			{
				accessorKey: "evidence_count",
				header: "Evidence",
				cell: ({ row }) => {
					const count = row.original.evidence_count;
					if (!count) {
						return <span className="text-muted-foreground text-xs">—</span>;
					}
					return (
						<Badge variant="secondary" className="gap-1 px-1.5 py-0 text-[10px]">
							<FileText className="h-2.5 w-2.5" />
							{count}
						</Badge>
					);
				},
				enableSorting: true,
			},
			{
				accessorKey: "score",
				header: "ICP Score",
				cell: ({ row }) => {
					const { score, confidence, band } = row.original;
					if (confidence === 0 || score == null) {
						return <span className="text-muted-foreground text-xs">—</span>;
					}
					return (
						<span className="inline-flex items-center gap-1.5">
							<span className="font-medium text-xs tabular-nums">{Math.round(score * 100)}%</span>
							{band === "HIGH" || band === "MEDIUM" || band === "LOW" ? <BandBadge band={band} /> : null}
						</span>
					);
				},
				enableSorting: true,
				sortingFn: (a, b) => {
					const aScore = a.original.confidence === 0 ? -1 : (a.original.score ?? -1);
					const bScore = b.original.confidence === 0 ? -1 : (b.original.score ?? -1);
					return aScore - bScore;
				},
			},
		],
		[routes.people]
	);

	const table = useReactTable({
		data: people,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (people.length === 0) {
		return null;
	}

	const headerCellClass = (columnId: string) => {
		switch (columnId) {
			case "name":
				return "w-[28%]";
			case "title":
				return "w-[22%]";
			case "company":
				return "w-[22%]";
			case "evidence_count":
				return "w-[10%]";
			case "score":
				return "w-[18%]";
			default:
				return "";
		}
	};

	const bodyCellClass = (columnId: string) => {
		switch (columnId) {
			case "name":
			case "title":
			case "company":
				return "py-1.5 align-middle";
			default:
				return "py-1.5 align-middle whitespace-nowrap";
		}
	};

	return (
		<div className="overflow-hidden rounded-lg border bg-background">
			<Table className="w-full table-fixed">
				<TableHeader>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
									className={[
										header.column.getCanSort() ? "cursor-pointer select-none text-xs" : "text-xs",
										headerCellClass(header.column.id),
									]
										.filter(Boolean)
										.join(" ")}
								>
									{flexRender(header.column.columnDef.header, header.getContext())}
									{header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{table.getRowModel().rows.map((row) => (
						<TableRow
							key={row.id}
							className="cursor-pointer hover:bg-muted/50"
							onClick={() => onEditPerson(row.original)}
						>
							{row.getVisibleCells().map((cell) => (
								<TableCell key={cell.id} className={bodyCellClass(cell.column.id)}>
									{flexRender(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
