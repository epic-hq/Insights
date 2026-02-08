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
import { CheckSquareIcon, ChevronDown, ChevronRight, Columns3, Users } from "lucide-react";

// Segment data for an insight
export interface InsightSegmentData {
	jobFunction: Record<string, number>;
	seniority: Record<string, number>;
	segment: Record<string, number>;
	facets: Record<string, number>;
}

import { useEffect, useId, useMemo, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useCurrentProject } from "~/contexts/current-project-context";
import { PriorityBars, priorityConfig } from "~/features/tasks/components/PriorityBars";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import { createClient } from "~/lib/supabase/client";
import { cn } from "~/lib/utils";
import type { Insight as BaseInsight } from "~/types";
import { InsightActions } from "./InsightActions";

const ENABLE_LINKED_TASK_LOOKUP = false;

// Extend Insight to include computed fields
type Insight = BaseInsight & {
	priority: number;
	evidence_count?: number;
	person_count?: number;
	persona_insights?: Array<{ personas: { id: string; name: string | null } }>;
};

interface InsightsDataTableProps {
	data: Insight[];
	segmentData?: Record<string, InsightSegmentData>;
}

// Helper to get top N entries from a count object
function getTopEntries(counts: Record<string, number>, n: number): Array<{ label: string; count: number }> {
	return Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([label, count]) => ({ label, count }));
}

// Segment breakdown cell component
function SegmentBreakdownCell({
	data,
	type,
}: {
	data: InsightSegmentData | undefined;
	type: "jobFunction" | "seniority" | "segment" | "facets";
}) {
	if (!data) return <span className="text-muted-foreground text-sm">-</span>;

	const counts = data[type];
	const entries = getTopEntries(counts, 3);

	if (entries.length === 0) {
		return <span className="text-muted-foreground text-sm">-</span>;
	}

	return (
		<div className="flex flex-wrap gap-1">
			{entries.map(({ label, count }) => (
				<Badge key={label} variant="outline" className="gap-1 px-1.5 py-0.5 text-[10px]">
					<span className="max-w-[80px] truncate">{label}</span>
					<span className="text-muted-foreground">({count})</span>
				</Badge>
			))}
		</div>
	);
}

type ViewMode = "flat" | "grouped";

const STORAGE_KEY = "insights_table_columns_v3";
const VIEW_MODE_KEY = "insights_table_view_mode";

// Column labels for visibility selector (ordered)
const columnLabels: Record<string, string> = {
	name: "Insight theme",
	person_count: "People",
	evidence_count: "Evidence",
	// Segment columns grouped together
	seg_jobFunction: "Job Function",
	seg_seniority: "Seniority",
	seg_facets: "Facets",
	// NOTE: seg_segment removed - deprecated field
	segment: "Personas",
	// JTBD columns
	jtbd: "JTBD",
	impact: "Impact",
	benefit: "Benefit",
	priority: "Priority",
};

// Columns that should have segment header styling
const SEGMENT_COLUMNS = new Set(["seg_jobFunction", "seg_seniority", "seg_facets"]);

// Default column visibility
const defaultColumnVisibility: VisibilityState = {
	name: true,
	person_count: true,
	evidence_count: true,
	segment: false, // Hide personas by default
	seg_jobFunction: true,
	seg_seniority: true,
	seg_facets: true, // Show facets - they have data from interview analysis
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
	const result: { category: string; insights: Insight[] }[] = sortedCategories.map((category) => ({
		category,
		insights: groups[category],
	}));

	if (uncategorized.length > 0) {
		result.push({ category: "Uncategorized", insights: uncategorized });
	}

	return result;
}

// Truncate text helper
function truncateText(text: string | null | undefined, maxLength: number): string {
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
		if (!ENABLE_LINKED_TASK_LOOKUP || !enableLinkedTaskLookup) return;

		let cancelled = false;

		async function checkLinkedTask() {
			try {
				const supabase = createClient();
				const { data } = await supabase.from("tasks").select("id").eq("source_theme_id", insightId).limit(1);

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
function PriorityPopover({ priority, onSelect }: { priority: number; onSelect: (p: number) => void }) {
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
								<span className="ml-2">{priorityConfig[p as 1 | 2 | 3].label}</span>
							</Button>
						))}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function InsightsDataTable({ data, segmentData }: InsightsDataTableProps) {
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");
	const priorityFetcher = useFetcher();
	const view_mode_id = useId();

	const [sorting, setSorting] = useState<SortingState>([{ id: "evidence_count", desc: true }]);
	const [columnFilters, setColumnFilters] = useState<any[]>([]);
	const [viewMode, setViewMode] = useState<ViewMode>(() => {
		if (typeof window === "undefined") return "grouped";
		try {
			const stored = window.localStorage.getItem(VIEW_MODE_KEY);
			return stored === "flat" ? "flat" : "grouped";
		} catch {
			return "grouped";
		}
	});
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		() => new Set() // Start empty, will be initialized once
	);
	const [hasInitializedExpanded, setHasInitializedExpanded] = useState(false);
	const [filterValue, setFilterValue] = useState("");

	// Column visibility with localStorage persistence
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
		if (typeof window === "undefined") return defaultColumnVisibility;
		try {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			return stored ? JSON.parse(stored) : defaultColumnVisibility;
		} catch {
			return defaultColumnVisibility;
		}
	});

	// Persist column visibility to localStorage
	useEffect(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(columnVisibility));
		}
	}, [columnVisibility]);

	// Persist view mode to localStorage
	useEffect(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
		}
	}, [viewMode]);

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
			}
		);
	};

	// Filter data based on search
	const filteredData = useMemo(() => {
		if (!filterValue.trim()) return data;
		const normalized = filterValue.trim().toLowerCase();
		return data.filter((insight) => {
			const haystack = [insight.name, insight.statement, insight.category, insight.jtbd, insight.desired_outcome];
			return haystack.some((text) => typeof text === "string" && text.toLowerCase().includes(normalized));
		});
	}, [data, filterValue]);

	// Group filtered data
	const grouped = useMemo(() => groupByCategory(filteredData), [filteredData]);

	// Initialize expanded categories ONLY once on first load
	useEffect(() => {
		if (!hasInitializedExpanded && grouped.length > 0) {
			setExpandedCategories(new Set(grouped.map((g) => g.category)));
			setHasInitializedExpanded(true);
		}
	}, [grouped, hasInitializedExpanded]);

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

	const expandAll = () => setExpandedCategories(new Set(grouped.map((g) => g.category)));
	const collapseAll = () => setExpandedCategories(new Set());

	const columns = useMemo<ColumnDef<Insight>[]>(
		() => [
			{
				id: "name",
				accessorFn: (row) => row.name || "Untitled theme",
				header: () => "Insight theme",
				cell: (cell: CellContext<Insight, unknown>) => (
					<div className="flex items-center">
						<Link
							to={routes.insights.detail(cell.row.original.id)}
							className="font-medium text-primary hover:underline"
						>
							{cell.getValue() as string}
						</Link>
						<LinkedTaskIndicator insightId={cell.row.original.id} projectPath={projectPath || ""} />
					</div>
				),
			},
			{
				id: "person_count",
				accessorFn: (row) => row.person_count ?? 0,
				header: () => "People",
				cell: (cell: CellContext<Insight, unknown>) => {
					const count = cell.getValue() as number;
					return count > 0 ? (
						<span className="font-semibold text-sm">{count}</span>
					) : (
						<span className="text-muted-foreground text-sm">0</span>
					);
				},
			},
			{
				id: "evidence_count",
				accessorFn: (row) => row.evidence_count ?? 0,
				header: () => "Evidence",
				cell: (cell: CellContext<Insight, unknown>) => {
					const count = cell.getValue() as number;
					const insightId = cell.row.original.id;
					return count > 0 ? (
						<Link to={`${routes.evidence.index()}?theme_id=${insightId}`} className="hover:underline">
							<span className="font-semibold text-sm">{count}</span>
						</Link>
					) : (
						<span className="text-muted-foreground text-sm">0</span>
					);
				},
			},
			// Demographic segment columns (grouped together after counts)
			{
				id: "seg_jobFunction",
				accessorFn: (row) => segmentData?.[row.id]?.jobFunction || {},
				header: () => "Job Function",
				cell: (cell: CellContext<Insight, unknown>) => (
					<SegmentBreakdownCell data={segmentData?.[cell.row.original.id]} type="jobFunction" />
				),
			},
			{
				id: "seg_seniority",
				accessorFn: (row) => segmentData?.[row.id]?.seniority || {},
				header: () => "Seniority",
				cell: (cell: CellContext<Insight, unknown>) => (
					<SegmentBreakdownCell data={segmentData?.[cell.row.original.id]} type="seniority" />
				),
			},
			// NOTE: seg_segment column removed - deprecated field
			{
				id: "seg_facets",
				accessorFn: (row) => segmentData?.[row.id]?.facets || {},
				header: () => "Facets",
				cell: (cell: CellContext<Insight, unknown>) => (
					<SegmentBreakdownCell data={segmentData?.[cell.row.original.id]} type="facets" />
				),
			},
			// Personas column (after segment columns)
			{
				id: "segment",
				accessorFn: (row) => row.persona_insights?.map((p) => p.personas?.name).filter(Boolean) || [],
				header: () => "Personas",
				cell: (cell: CellContext<Insight, unknown>) => {
					const personas = cell.getValue() as string[];
					if (!personas.length) return <span className="text-muted-foreground text-sm">-</span>;
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
					if (!jtbd) return <span className="text-muted-foreground text-sm">-</span>;
					return (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help text-sm">{truncateText(jtbd, 40)}</span>
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
					if (!impact) return <span className="text-muted-foreground text-sm">-</span>;
					return (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help text-sm">{truncateText(impact, 30)}</span>
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
					if (!benefit) return <span className="text-muted-foreground text-sm">-</span>;
					return (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="cursor-help text-sm">{truncateText(benefit, 30)}</span>
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
					return <PriorityPopover priority={priority} onSelect={(p) => handlePriorityChange(insightId, p)} />;
				},
			},
			{
				id: "actions",
				header: () => "Actions",
				cell: (cell: CellContext<Insight, unknown>) => {
					const insight = cell.row.original;
					return <InsightActions insight={insight} projectPath={projectPath || ""} size="sm" showLabel={false} />;
				},
			},
		],
		[routes.evidence, routes.insights, projectPath, segmentData]
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
		const sortedInsights = [...insights].sort((a, b) => (b.evidence_count ?? 0) - (a.evidence_count ?? 0));

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
										onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
									>
										{label}
									</DropdownMenuCheckboxItem>
								);
							})}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* View mode toggle */}
					<div className="flex items-center gap-2">
						<Label htmlFor={view_mode_id} className="text-muted-foreground text-sm">
							Flat
						</Label>
						<Switch
							id={view_mode_id}
							checked={viewMode === "grouped"}
							onCheckedChange={(checked) => setViewMode(checked ? "grouped" : "flat")}
						/>
						<Label htmlFor={view_mode_id} className="text-muted-foreground text-sm">
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
										<TableHead
											key={column.id}
											className={cn(SEGMENT_COLUMNS.has(column.id) && "bg-blue-50 dark:bg-blue-950/30")}
										>
											{flexRender(column.columnDef.header, { column } as any)}
										</TableHead>
									))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{grouped.map(({ category, insights: categoryInsights }) => (
								<>
									{/* Category separator row */}
									<TableRow key={`group-${category}`} className="hover:bg-transparent">
										<TableCell
											colSpan={table.getAllColumns().filter((col) => col.getIsVisible()).length}
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
									{expandedCategories.has(category) && renderCategoryRows(categoryInsights)}
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
											className={cn(
												"cursor-pointer select-none",
												SEGMENT_COLUMNS.has(header.id) && "bg-blue-50 dark:bg-blue-950/30"
											)}
										>
											{flexRender(header.column.columnDef.header, header.getContext())}
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
									<TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
										No insights found
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
			)}
		</div>
	);
}
