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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { ICPScoredPerson } from "./AnalysisByPersonTab";
import { BandBadge } from "./ICPMatchSection";

type ICPScoredPeopleTableProps = {
  people: ICPScoredPerson[];
  projectPath: string;
  onEditPerson: (person: ICPScoredPerson) => void;
};

export function ICPScoredPeopleTable({
  people,
  projectPath,
  onEditPerson,
}: ICPScoredPeopleTableProps) {
  const routes = useProjectRoutes(projectPath);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "score", desc: true },
  ]);

  const columns = useMemo<ColumnDef<ICPScoredPerson>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <Link
            to={routes.people.detail(row.original.person_id)}
            className="font-medium text-sm hover:underline"
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
          return <span className="text-xs text-foreground/70">{val}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: "company",
        header: "Company",
        cell: ({ row }) => {
          const val = row.original.company;
          if (!val) {
            return (
              <span className="rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400">
                —
              </span>
            );
          }
          return <span className="text-xs text-foreground/70">{val}</span>;
        },
        enableSorting: false,
      },
      {
        accessorKey: "evidence_count",
        header: "Evidence",
        cell: ({ row }) => {
          const count = row.original.evidence_count;
          if (!count) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[10px]"
            >
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
          const { score, confidence } = row.original;
          if (confidence === 0 || score == null) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className="font-medium tabular-nums text-xs">
              {Math.round(score * 100)}%
            </span>
          );
        },
        enableSorting: true,
        sortingFn: (a, b) => {
          const aScore =
            a.original.confidence === 0 ? -1 : (a.original.score ?? -1);
          const bScore =
            b.original.confidence === 0 ? -1 : (b.original.score ?? -1);
          return aScore - bScore;
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <BandBadge
            band={row.original.band}
            confidence={row.original.confidence}
          />
        ),
        enableSorting: true,
        sortingFn: (a, b) => {
          const order: Record<string, number> = {
            HIGH: 4,
            MEDIUM: 3,
            LOW: 2,
          };
          const aVal = a.original.band
            ? (order[a.original.band] ?? 1)
            : a.original.confidence === 0
              ? 0
              : 1;
          const bVal = b.original.band
            ? (order[b.original.band] ?? 1)
            : b.original.confidence === 0
              ? 0
              : 1;
          return aVal - bVal;
        },
      },
    ],
    [routes.people],
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

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  onClick={
                    header.column.getCanSort()
                      ? header.column.getToggleSortingHandler()
                      : undefined
                  }
                  className={
                    header.column.getCanSort()
                      ? "cursor-pointer select-none text-xs"
                      : "text-xs"
                  }
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {header.column.getIsSorted() === "asc"
                    ? " ↑"
                    : header.column.getIsSorted() === "desc"
                      ? " ↓"
                      : ""}
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
                <TableCell key={cell.id} className="py-1.5">
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
