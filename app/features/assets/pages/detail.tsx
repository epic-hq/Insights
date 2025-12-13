import type { ColumnDef, SortingState } from "@tanstack/react-table"
import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table"
import consola from "consola"
import { formatDistance } from "date-fns"
import { ArrowLeft, ArrowUpDown, ChevronLeft, ChevronRight, Download, HelpCircle, MoreHorizontal, Plus, Search, Table, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useFetcher, useLoaderData, useNavigate } from "react-router"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import InlineEdit from "~/components/ui/inline-edit"
import { Input } from "~/components/ui/input"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.asset?.title || "Asset"} | Insights` },
		{ name: "description", content: data?.asset?.description || "View and edit asset data" },
	]
}

interface ProjectAsset {
	id: string
	title: string
	description: string | null
	asset_type: string
	row_count: number | null
	column_count: number | null
	table_data: { headers: string[]; rows: Record<string, unknown>[] } | null
	content_md: string | null
	status: string | null
	source_type: string | null
	created_at: string
	updated_at: string
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const assetId = params.assetId

	if (!assetId) {
		throw new Response("Asset ID is required", { status: 400 })
	}

	const { data: asset, error } = await supabase
		.from("project_assets")
		.select(
			"id, title, description, asset_type, row_count, column_count, table_data, content_md, status, source_type, created_at, updated_at"
		)
		.eq("id", assetId)
		.single()

	if (error || !asset) {
		consola.error("Asset query error:", error)
		throw new Response("Asset not found", { status: 404 })
	}

	return { asset: asset as ProjectAsset }
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const assetId = params.assetId

	if (!assetId) {
		return { error: "Asset ID is required" }
	}

	const formData = await request.formData()
	const actionType = formData.get("_action") as string

	if (actionType === "update-field") {
		const field = formData.get("field") as string
		const value = formData.get("value") as string

		if (!field) {
			return { error: "Field name is required" }
		}

		// Only allow updating certain fields
		const allowedFields = ["title", "description"]
		if (!allowedFields.includes(field)) {
			return { error: `Field ${field} is not editable` }
		}

		const { error } = await supabase
			.from("project_assets")
			.update({ [field]: value || null, updated_at: new Date().toISOString() })
			.eq("id", assetId)

		if (error) {
			consola.error("Failed to update asset field:", error)
			return { error: "Failed to update field" }
		}

		return { success: true }
	}

	if (actionType === "delete") {
		const { error } = await supabase
			.from("project_assets")
			.delete()
			.eq("id", assetId)

		if (error) {
			consola.error("Failed to delete asset:", error)
			return { error: "Failed to delete asset" }
		}

		return { success: true, deleted: true }
	}

	if (actionType === "update-cell") {
		const rowIndex = Number.parseInt(formData.get("rowIndex") as string, 10)
		const columnKey = formData.get("columnKey") as string
		const value = formData.get("value") as string

		// Fetch current table_data
		const { data: asset, error: fetchError } = await supabase
			.from("project_assets")
			.select("table_data")
			.eq("id", assetId)
			.single()

		if (fetchError || !asset?.table_data) {
			return { error: "Failed to fetch asset data" }
		}

		const tableData = asset.table_data as { headers: string[]; rows: Record<string, unknown>[] }

		// Update the specific cell
		if (tableData.rows[rowIndex]) {
			tableData.rows[rowIndex][columnKey] = value
		}

		const { error: updateError } = await supabase
			.from("project_assets")
			.update({ table_data: tableData, updated_at: new Date().toISOString() })
			.eq("id", assetId)

		if (updateError) {
			consola.error("Failed to update cell:", updateError)
			return { error: "Failed to update cell" }
		}

		return { success: true }
	}

	if (actionType === "add-row") {
		// Fetch current table_data
		const { data: asset, error: fetchError } = await supabase
			.from("project_assets")
			.select("table_data, row_count")
			.eq("id", assetId)
			.single()

		if (fetchError || !asset?.table_data) {
			return { error: "Failed to fetch asset data" }
		}

		const tableData = asset.table_data as { headers: string[]; rows: Record<string, unknown>[] }

		// Create empty row with all headers
		const newRow: Record<string, string> = {}
		for (const header of tableData.headers) {
			newRow[header] = ""
		}
		tableData.rows.push(newRow)

		const { error: updateError } = await supabase
			.from("project_assets")
			.update({
				table_data: tableData,
				row_count: tableData.rows.length,
				updated_at: new Date().toISOString(),
			})
			.eq("id", assetId)

		if (updateError) {
			consola.error("Failed to add row:", updateError)
			return { error: "Failed to add row" }
		}

		return { success: true, action: "add-row" }
	}

	if (actionType === "add-column") {
		const columnName = formData.get("columnName") as string

		if (!columnName?.trim()) {
			return { error: "Column name is required" }
		}

		// Fetch current table_data
		const { data: asset, error: fetchError } = await supabase
			.from("project_assets")
			.select("table_data, column_count")
			.eq("id", assetId)
			.single()

		if (fetchError || !asset?.table_data) {
			return { error: "Failed to fetch asset data" }
		}

		const tableData = asset.table_data as { headers: string[]; rows: Record<string, unknown>[] }

		// Check if column already exists
		if (tableData.headers.includes(columnName.trim())) {
			return { error: "Column already exists" }
		}

		// Add column to headers and all rows
		tableData.headers.push(columnName.trim())
		for (const row of tableData.rows) {
			row[columnName.trim()] = ""
		}

		const { error: updateError } = await supabase
			.from("project_assets")
			.update({
				table_data: tableData,
				column_count: tableData.headers.length,
				updated_at: new Date().toISOString(),
			})
			.eq("id", assetId)

		if (updateError) {
			consola.error("Failed to add column:", updateError)
			return { error: "Failed to add column" }
		}

		return { success: true, action: "add-column" }
	}

	return { error: "Unknown action" }
}

function EditableCell({
	assetId,
	rowIndex,
	columnKey,
	value,
}: {
	assetId: string
	rowIndex: number
	columnKey: string
	value: string
}) {
	const fetcher = useFetcher()

	const handleSubmit = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-cell")
		formData.append("rowIndex", rowIndex.toString())
		formData.append("columnKey", columnKey)
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<InlineEdit
			value={value}
			onSubmit={handleSubmit}
			textClassName="text-sm text-foreground truncate"
			inputClassName="text-sm"
			placeholder="-"
		/>
	)
}

function EditableAssetField({
	assetId,
	field,
	value,
	multiline = false,
	textClassName = "text-sm",
}: {
	assetId: string
	field: string
	value: string
	multiline?: boolean
	textClassName?: string
}) {
	const fetcher = useFetcher()

	const handleSubmit = (newValue: string) => {
		if (newValue === value) return

		const formData = new FormData()
		formData.append("_action", "update-field")
		formData.append("field", field)
		formData.append("value", newValue)

		fetcher.submit(formData, { method: "POST" })
	}

	return (
		<InlineEdit
			value={value}
			onSubmit={handleSubmit}
			textClassName={textClassName}
			inputClassName="text-sm"
			multiline={multiline}
			placeholder={`Add ${field}...`}
		/>
	)
}

function SortableHeader({ column, title }: { column: any; title: string }) {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="-ml-3 h-8 data-[state=open]:bg-accent"
			onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
		>
			{title}
			<ArrowUpDown className="ml-2 h-4 w-4" />
		</Button>
	)
}

export default function AssetDetailPage() {
	const { asset } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)
	const navigate = useNavigate()
	const deleteFetcher = useFetcher()
	const addRowFetcher = useFetcher()
	const addColumnFetcher = useFetcher()
	const [sorting, setSorting] = useState<SortingState>([])
	const [globalFilter, setGlobalFilter] = useState("")
	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
	const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false)
	const [newColumnName, setNewColumnName] = useState("")

	// Handle delete redirect - go to files tab
	const deleteResult = deleteFetcher.data as { deleted?: boolean } | undefined
	if (deleteResult?.deleted) {
		navigate(`${routes.interviews.index()}?tab=files`)
	}

	// Add row handler
	const handleAddRow = () => {
		addRowFetcher.submit({ _action: "add-row" }, { method: "POST" })
	}

	// Add column handler
	const handleAddColumn = () => {
		if (!newColumnName.trim()) return
		addColumnFetcher.submit(
			{ _action: "add-column", columnName: newColumnName.trim() },
			{ method: "POST" }
		)
		setNewColumnName("")
		setAddColumnDialogOpen(false)
	}

	// Parse table data
	const tableData = asset.table_data as { headers: string[]; rows: Record<string, unknown>[] } | null
	const headers = tableData?.headers || []
	const rows = tableData?.rows || []

	// Create columns dynamically from headers
	const columns: ColumnDef<Record<string, unknown>>[] = useMemo(() => {
		return headers.map((header, index) => ({
			accessorKey: header,
			header: ({ column }) => <SortableHeader column={column} title={header} />,
			cell: ({ row }) => {
				const value = String(row.getValue(header) ?? "")
				return <EditableCell assetId={asset.id} rowIndex={row.index} columnKey={header} value={value} />
			},
			filterFn: "includesString",
		}))
	}, [headers, asset.id])

	const table = useReactTable({
		data: rows,
		columns,
		state: {
			sorting,
			globalFilter,
			pagination,
		},
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		globalFilterFn: "includesString",
	})

	const handleExportCSV = () => {
		if (!tableData) return

		const csvContent = [
			headers.join(","),
			...rows.map((row) =>
				headers
					.map((h) => {
						const val = String(row[h] ?? "")
						// Escape quotes and wrap in quotes if contains comma
						if (val.includes(",") || val.includes('"') || val.includes("\n")) {
							return `"${val.replace(/"/g, '""')}"`
						}
						return val
					})
					.join(",")
			),
		].join("\n")

		const blob = new Blob([csvContent], { type: "text/csv" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `${asset.title.replace(/[^a-z0-9]/gi, "_")}.csv`
		a.click()
		URL.revokeObjectURL(url)
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<div className="border-border border-b bg-card px-6 py-6">
				<PageContainer size="lg" padded={false} className="max-w-7xl">
					<div className="flex items-start gap-4">
						<Link
							to={routes.interviews.index()}
							className="mt-1 flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<ArrowLeft className="h-4 w-4" />
						</Link>
						<div className="flex-1">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Table className="h-5 w-5 text-primary" />
								</div>
								<div className="flex-1">
									<EditableAssetField
										assetId={asset.id}
										field="title"
										value={asset.title}
										textClassName="text-xl font-semibold"
									/>
								</div>
							</div>
							<div className="mt-2 ml-13">
								<EditableAssetField
									assetId={asset.id}
									field="description"
									value={asset.description || ""}
									multiline
									textClassName="text-sm text-muted-foreground"
								/>
							</div>
							<div className="mt-3 ml-13 flex flex-wrap items-center gap-4 text-muted-foreground text-sm">
								<span className="capitalize">{asset.asset_type}</span>
								{asset.row_count && asset.column_count && (
									<>
										<span>•</span>
										<span>
											{asset.row_count} rows × {asset.column_count} columns
										</span>
									</>
								)}
								<span>•</span>
								<span>Updated {formatDistance(new Date(asset.updated_at), new Date(), { addSuffix: true })}</span>
							</div>
						</div>
						{/* Actions Menu */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8">
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleExportCSV}>
									<Download className="mr-2 h-4 w-4" />
									Export CSV
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={() => {
										if (confirm("Delete this file? This cannot be undone.")) {
											deleteFetcher.submit(
												{ _action: "delete" },
												{ method: "POST" }
											)
										}
									}}
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</PageContainer>
			</div>

			{/* Table Controls */}
			<PageContainer size="lg" padded className="max-w-7xl py-4">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-4">
					<div className="relative max-w-sm flex-1">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search all columns..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9"
						/>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground text-sm">
							{table.getFilteredRowModel().rows.length} of {rows.length} rows
						</span>
						<Popover>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="sm" className="text-muted-foreground">
									<HelpCircle className="h-4 w-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-80" align="end">
								<div className="space-y-3">
									<h4 className="font-medium">How to use this table</h4>
									<div className="space-y-2 text-muted-foreground text-sm">
										<p>
											<strong className="text-foreground">Inline editing:</strong> Click any cell to edit it directly.
											Changes save automatically.
										</p>
										<p>
											<strong className="text-foreground">Search:</strong> Use the search box to filter across all
											columns instantly.
										</p>
										<p>
											<strong className="text-foreground">Sort:</strong> Click column headers to sort ascending or
											descending.
										</p>
										<p>
											<strong className="text-foreground">Export:</strong> Download the table as CSV for use in Excel
											or Google Sheets.
										</p>
										<p>
											<strong className="text-foreground">Chat updates:</strong> Ask the AI assistant to add rows,
											update values, or add columns. Example: "Add a row for website URLs to the competitive matrix"
										</p>
									</div>
								</div>
							</PopoverContent>
						</Popover>
						<Button
							variant="outline"
							size="sm"
							onClick={handleAddRow}
							disabled={addRowFetcher.state !== "idle"}
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Row
						</Button>
						<Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm">
									<Plus className="mr-2 h-4 w-4" />
									Add Column
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-[400px]">
								<DialogHeader>
									<DialogTitle>Add Column</DialogTitle>
									<DialogDescription>
										Enter a name for the new column. It will be added to all rows with empty values.
									</DialogDescription>
								</DialogHeader>
								<div className="py-4">
									<Input
										placeholder="Column name"
										value={newColumnName}
										onChange={(e) => setNewColumnName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleAddColumn()
										}}
									/>
								</div>
								<DialogFooter>
									<Button variant="outline" onClick={() => setAddColumnDialogOpen(false)}>
										Cancel
									</Button>
									<Button
										onClick={handleAddColumn}
										disabled={!newColumnName.trim() || addColumnFetcher.state !== "idle"}
									>
										Add Column
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</div>

				{/* Data Table */}
				{tableData ? (
					<div className="rounded-lg border">
						<div className="overflow-x-auto">
							<table className="w-full border-collapse text-sm">
								<thead>
									{table.getHeaderGroups().map((headerGroup) => (
										<tr key={headerGroup.id} className="border-b bg-muted/50">
											{headerGroup.headers.map((header) => (
												<th key={header.id} className="whitespace-nowrap px-4 py-3 text-left font-semibold">
													{header.isPlaceholder
														? null
														: flexRender(header.column.columnDef.header, header.getContext())}
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody>
									{table.getRowModel().rows.map((row) => (
										<tr key={row.id} className="border-b hover:bg-muted/30">
											{row.getVisibleCells().map((cell) => (
												<td key={cell.id} className="px-4 py-2">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Pagination */}
						<div className="flex items-center justify-between border-t px-4 py-3">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => table.previousPage()}
									disabled={!table.getCanPreviousPage()}
								>
									<ChevronLeft className="h-4 w-4" />
									Previous
								</Button>
								<Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
									Next
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
							<div className="flex items-center gap-4 text-muted-foreground text-sm">
								<span>
									Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
								</span>
								<select
									value={pagination.pageSize}
									onChange={(e) => setPagination((prev) => ({ ...prev, pageSize: Number(e.target.value) }))}
									className="rounded-md border px-2 py-1 text-sm"
								>
									{[25, 50, 100, 250].map((size) => (
										<option key={size} value={size}>
											{size} per page
										</option>
									))}
								</select>
							</div>
						</div>
					</div>
				) : (
					<div className="rounded-lg border bg-card p-8 text-center">
						<p className="text-muted-foreground">No table data available for this asset.</p>
					</div>
				)}
			</PageContainer>
		</div>
	)
}
