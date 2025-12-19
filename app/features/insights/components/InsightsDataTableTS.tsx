/**
 * InsightsDataTable - Table view for insights/themes with prioritization
 *
 * Features:
 * - Flat view by default (grouped view optional)
 * - Columns: Name, Evidence, Segment, JTBD, Impact, Benefit, Priority
 * - Column visibility selector with localStorage persistence
 * - Priority selector (1-3) on each row
 * - Create Task action
 */

import {
  type CellContext,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  CheckSquareIcon,
  ChevronDown,
  ChevronRight,
  Columns3,
  Link2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useFetcher } from "react-router-dom";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import {
  PriorityBars,
  priorityConfig,
} from "~/features/tasks/components/PriorityBars";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { createClient } from "~/lib/supabase/client";
import type { Insight as BaseInsight } from "~/types";
import { InsightActions } from "./InsightActions";

// Extend Insight to include computed fields
type Insight = BaseInsight & {
  priority: number;
  evidence_count?: number;
  persona_insights?: Array<{ personas: { id: string; name: string | null } }>;
};

interface InsightsDataTableProps {
  data: Insight[];
}

type ViewMode = "flat" | "grouped";

const STORAGE_KEY = "insights_table_columns_v2";

// Column labels for visibility selector
const columnLabels: Record<string, string> = {
  name: "Theme Name",
  evidence_count: "Evidence",
  segment: "Segment",
  jtbd: "JTBD",
  impact: "Impact",
  benefit: "Benefit",
  priority: "Priority",
};

// Default column visibility
const defaultColumnVisibility: VisibilityState = {
  name: true,
  evidence_count: true,
  segment: true,
  jtbd: true,
  impact: true,
  benefit: true,
  priority: true,
};

// Group insights by category
function groupByCategory(insights: Insight[]) {
  const groups: Record<string, Insight[]> = {};
  const uncategorized: Insight[] = [];

  for (const insight of insights) {
    const category = insight.category;
    if (category) {
      if (!groups[category]) groups[category] = [];
      groups[category].push(insight);
    } else {
      uncategorized.push(insight);
    }
  }

  const sortedCategories = Object.keys(groups).sort();
  const result: { category: string; insights: Insight[] }[] =
    sortedCategories.map((category) => ({
      category,
      insights: groups[category],
    }));

  if (uncategorized.length > 0) {
    result.push({ category: "Uncategorized", insights: uncategorized });
  }

  return result;
}

// Truncate text helper
function truncateText(
  text: string | null | undefined,
  maxLength: number,
): string {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

// Small badge to indicate a linked task exists
function LinkedTaskIndicator({
  insightId,
  projectPath,
  enableLinkedTaskLookup = false,
}: {
  insightId: string;
  projectPath: string;
  enableLinkedTaskLookup?: boolean;
}) {
  const [linkedTaskId, setLinkedTaskId] = useState<string | null>(null);
  const routes = useProjectRoutes(projectPath);

  useEffect(() => {
    if (!enableLinkedTaskLookup) return;

    let cancelled = false;

    async function checkLinkedTask() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("tasks")
          .select("id")
          .eq("source_theme_id", insightId)
          .limit(1);

        const id = (data as Array<{ id: string }> | null)?.[0]?.id;
        if (!cancelled && id) {
          setLinkedTaskId(id);
        }
      } catch {
        // No linked task found
      }
    }

    checkLinkedTask();

    return () => {
      cancelled = true;
    };
  }, [enableLinkedTaskLookup, insightId]);

  if (!linkedTaskId) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to={routes.tasks.detail(linkedTaskId)}>
            <Badge
              variant="default"
              className="ml-2 cursor-pointer gap-1 bg-blue-600/50 px-1.5 py-0.5 text-[10px] hover:bg-blue-700"
            >
              <CheckSquareIcon className="h-2.5 w-2.5" />
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>View linked task</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Priority popover component matching Tasks page
function PriorityPopover({
  priority,
  onSelect,
}: {
  priority: number;
  onSelect: (p: number) => void;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (p: number) => {
    if (p !== priority) {
      onSelect(p);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-auto p-1 hover:bg-muted">
          <PriorityBars priority={priority} size="default" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48" align="center">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Set Priority</h4>
          <div className="space-y-1">
            {[3, 2, 1].map((p) => (
              <Button
                key={p}
                variant={priority === p ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start"
                onClick={() => handleSelect(p)}
              >
                <PriorityBars priority={p} size="default" />
                <span className="ml-2">
                  {priorityConfig[p as 1 | 2 | 3].label}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function InsightsDataTable({ data }: InsightsDataTableProps) {
  const { projectPath } = useCurrentProject();
  const routes = useProjectRoutes(projectPath || "");
  const priorityFetcher = useFetcher();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "evidence_count", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("flat"); // Default to flat
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [filterValue, setFilterValue] = useState("");

  // Column visibility with localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => {
      if (typeof window === "undefined") return defaultColumnVisibility;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : defaultColumnVisibility;
      } catch {
        return defaultColumnVisibility;
      }
    },
  );

  // Persist column visibility to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(columnVisibility),
      );
    }
  }, [columnVisibility]);

  // Handle priority change
  const handlePriorityChange = (insightId: string, newPriority: number) => {
    priorityFetcher.submit(
      {
        table: "themes",
        id: insightId,
        field: "priority",
        value: newPriority.toString(),
      },
      {
        method: "post",
        action: `${projectPath}/insights/api/update-field`,
        encType: "application/json",
      },
    );
  };

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!filterValue.trim()) return data;
    const normalized = filterValue.trim().toLowerCase();
    return data.filter((insight) => {
      const haystack = [
        insight.name,
        insight.statement,
        insight.category,
        insight.jtbd,
        insight.desired_outcome,
      ];
      return haystack.some(
        (text) =>
          typeof text === "string" && text.toLowerCase().includes(normalized),
      );
    });
  }, [data, filterValue]);

  // Group filtered data
  const grouped = useMemo(() => groupByCategory(filteredData), [filteredData]);

  // Initialize expanded categories when grouped changes
  useMemo(() => {
    if (expandedCategories.size === 0 && grouped.length > 0) {
      setExpandedCategories(new Set(grouped.map((g) => g.category)));
    }
  }, [grouped, expandedCategories.size]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const expandAll = () =>
    setExpandedCategories(new Set(grouped.map((g) => g.category)));
  const collapseAll = () => setExpandedCategories(new Set());

  const columns = useMemo<ColumnDef<Insight>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name || "Untitled theme",
        header: () => "Theme Name",
        cell: (cell: CellContext<Insight, unknown>) => (
          <div className="flex items-center">
            <Link
              to={routes.insights.detail(cell.row.original.id)}
              className="font-medium text-primary hover:underline"
            >
              {cell.getValue() as string}
            </Link>
            <LinkedTaskIndicator
              insightId={cell.row.original.id}
              projectPath={projectPath || ""}
            />
          </div>
        ),
      },
      {
        id: "evidence_count",
        accessorFn: (row) => row.evidence_count ?? 0,
        header: () => "Evidence",
        cell: (cell: CellContext<Insight, unknown>) => {
          const count = cell.getValue() as number;
          const insightId = cell.row.original.id;
          return count > 0 ? (
            <Link
              to={`${routes.evidence.index()}?theme_id=${insightId}`}
              className="hover:underline"
            >
              <span className="font-semibold text-sm">{count}</span>
            </Link>
          ) : (
            <span className="text-muted-foreground text-sm">0</span>
          );
        },
      },
      {
        id: "segment",
        accessorFn: (row) =>
          row.persona_insights?.map((p) => p.personas?.name).filter(Boolean) ||
          [],
        header: () => "Segment",
        cell: (cell: CellContext<Insight, unknown>) => {
          const personas = cell.getValue() as string[];
          if (!personas.length)
            return <span className="text-muted-foreground text-sm">-</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {personas.slice(0, 2).map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))}
              {personas.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{personas.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "jtbd",
        accessorFn: (row) => row.jtbd,
        header: () => "JTBD",
        cell: (cell: CellContext<Insight, unknown>) => {
          const jtbd = cell.getValue() as string | null;
          if (!jtbd)
            return <span className="text-muted-foreground text-sm">-</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-sm">
                    {truncateText(jtbd, 40)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>{jtbd}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "impact",
        accessorFn: (row) => row.impact,
        header: () => "Impact",
        cell: (cell: CellContext<Insight, unknown>) => {
          const impact = cell.getValue() as string | null;
          if (!impact)
            return <span className="text-muted-foreground text-sm">-</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-sm">
                    {truncateText(impact, 30)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>{impact}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "benefit",
        accessorFn: (row) => row.desired_outcome,
        header: () => "Benefit",
        cell: (cell: CellContext<Insight, unknown>) => {
          const benefit = cell.getValue() as string | null;
          if (!benefit)
            return <span className="text-muted-foreground text-sm">-</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-sm">
                    {truncateText(benefit, 30)}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>{benefit}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "priority",
        accessorFn: (row) => row.priority ?? 3,
        header: () => "Priority",
        cell: (cell: CellContext<Insight, unknown>) => {
          const priority = cell.getValue() as number;
          const insightId = cell.row.original.id;
          return (
            <PriorityPopover
              priority={priority}
              onSelect={(p) => handlePriorityChange(insightId, p)}
            />
          );
        },
      },
      {
        id: "actions",
        header: () => "Actions",
        cell: (cell: CellContext<Insight, unknown>) => {
          const insight = cell.row.original;
          return (
            <InsightActions
              insight={insight}
              projectPath={projectPath || ""}
              size="sm"
              showLabel={false}
            />
          );
        },
      },
    ],
    [routes.evidence, routes.insights, projectPath],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Render rows for grouped view (no headers - shared header at top)
  const renderCategoryRows = (insights: Insight[]) => {
    const sortedInsights = [...insights].sort(
      (a, b) => (b.evidence_count ?? 0) - (a.evidence_count ?? 0),
    );

    return sortedInsights.map((insight) => (
      <TableRow key={insight.id}>
        {columns
          .filter((_, i) => table.getAllColumns()[i]?.getIsVisible())
          .map((column, i) => (
            <TableCell key={column.id}>
              {flexRender(column.cell, {
                getValue: () => column.accessorFn?.(insight, i),
                row: { original: insight },
              } as any)}
            </TableCell>
          ))}
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Filter by name, JTBD, benefit..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          {/* Column visibility dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(columnLabels).map(([columnId, label]) => {
                const column = table.getColumn(columnId);
                if (!column) return null;
                return (
                  <DropdownMenuCheckboxItem
                    key={columnId}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(Boolean(value))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <Label
              htmlFor="view-mode"
              className="text-muted-foreground text-sm"
            >
              Flat
            </Label>
            <Switch
              id="view-mode"
              checked={viewMode === "grouped"}
              onCheckedChange={(checked) =>
                setViewMode(checked ? "grouped" : "flat")
              }
            />
            <Label
              htmlFor="view-mode"
              className="text-muted-foreground text-sm"
            >
              Grouped
            </Label>
          </div>
          {viewMode === "grouped" && (
            <>
              <Button variant="ghost" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Grouped View - Single table with fixed header */}
      {viewMode === "grouped" ? (
        <div className="rounded-md border">
          <Table>
            {/* Fixed header at top */}
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {table
                  .getAllColumns()
                  .filter((col) => col.getIsVisible())
                  .map((column) => (
                    <TableHead key={column.id}>
                      {flexRender(column.columnDef.header, { column } as any)}
                    </TableHead>
                  ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {grouped.map(({ category, insights: categoryInsights }) => (
                <>
                  {/* Category separator row */}
                  <TableRow
                    key={`group-${category}`}
                    className="hover:bg-transparent"
                  >
                    <TableCell
                      colSpan={
                        table
                          .getAllColumns()
                          .filter((col) => col.getIsVisible()).length
                      }
                      className="p-0"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex w-full items-center gap-2 bg-slate-100 px-4 py-2 text-left hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                      >
                        {expandedCategories.has(category) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-semibold text-slate-700 text-xs uppercase tracking-wide dark:text-slate-200">
                          {category} ({categoryInsights.length})
                        </span>
                      </button>
                    </TableCell>
                  </TableRow>
                  {/* Data rows for this category */}
                  {expandedCategories.has(category) &&
                    renderCategoryRows(categoryInsights)}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Flat View */
        <div className="rounded-md border">
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
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No insights found
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
