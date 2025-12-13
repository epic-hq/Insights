import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Update an existing table asset in project_assets.
 *
 * Supports adding rows, removing rows, updating cells, or replacing the entire table.
 */

function generateMarkdownTable(headers: string[], rows: Record<string, string>[], maxRows?: number): string {
	if (headers.length === 0) return "*No data to display*"

	const displayRows = maxRows ? rows.slice(0, maxRows) : rows
	const lines: string[] = []

	lines.push(`| ${headers.join(" | ")} |`)
	lines.push(`| ${headers.map(() => "---").join(" | ")} |`)

	for (const row of displayRows) {
		const values = headers.map((h) => {
			const val = row[h] || ""
			return val.replace(/\|/g, "\\|")
		})
		lines.push(`| ${values.join(" | ")} |`)
	}

	if (maxRows && rows.length > maxRows) {
		lines.push("")
		lines.push(`*...and ${rows.length - maxRows} more rows*`)
	}

	return lines.join("\n")
}

export const updateTableAssetTool = createTool({
	id: "updateTableAsset",
	description: `MODIFY an existing table. Use this for ANY changes to existing tables (add row, edit cell, add column, etc.)

⚠️ ALWAYS use this instead of saveTableToAssets when modifying existing tables!
The assetId is in the URL (/assets/{assetId}) or from previous tool results.

EXAMPLE - Adding a row to a table with columns ["Feature", "Marvin", "Competitor A"]:
{
  "assetId": "abc-123",
  "operation": "addRows",
  "newRows": [{"Feature": "Website", "Marvin": "marvin.com", "Competitor A": "competitor.com"}]
}

OPERATIONS:
1. addRows - MUST include ALL column headers as keys in each row object
   newRows: [{"Col1": "val", "Col2": "val", "Col3": "val"}]

2. updateRows - Update specific cells
   updates: [{"rowIndex": 0, "column": "Price", "value": "$50"}]

3. removeRows - Remove by 0-based index
   rowIndices: [0, 2]

4. addColumn - Add new column to all rows
   columnName: "Website", defaultValue: ""

5. replaceAll - Replace entire table
   headers: ["A","B"], rows: [{"A":"1","B":"2"}]

IMPORTANT: Do NOT redraw the table in chat after updating - the UI refreshes automatically.`,
	inputSchema: z.object({
		assetId: z.string().uuid().describe("ID of the table asset to update - from prior saveTableToAssets or conversation context"),
		operation: z.enum(["addRows", "updateRows", "removeRows", "addColumn", "replaceAll"]).describe("Type of update operation"),
		// For addRows
		newRows: z
			.array(z.record(z.string(), z.string()))
			.optional()
			.describe("For addRows: Array of row objects. MUST include ALL existing column headers as keys. Example: [{\"Feature\": \"X\", \"Us\": \"Y\", \"Competitor\": \"Z\"}]"),
		// For updateRows
		updates: z
			.array(
				z.object({
					rowIndex: z.number().describe("0-based row index"),
					column: z.string().describe("Column header name"),
					value: z.string().describe("New value"),
				})
			)
			.optional()
			.describe("For updateRows: array of cell updates"),
		// For removeRows
		rowIndices: z.array(z.number()).optional().describe("For removeRows: array of row indices to remove"),
		// For addColumn
		columnName: z.string().optional().describe("For addColumn: name of the new column"),
		defaultValue: z.string().optional().describe("For addColumn: default value for existing rows"),
		// For replaceAll
		headers: z.array(z.string()).optional().describe("For replaceAll: new column headers"),
		rows: z.array(z.record(z.string(), z.string())).optional().describe("For replaceAll: new row data"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		rowCount: z.number().optional(),
		columnCount: z.number().optional(),
		assetUrl: z.string().optional(),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const { assetId, operation, newRows, updates, rowIndices, columnName, defaultValue, headers, rows } = context

			const accountId = runtimeContext?.get?.("account_id") as string | undefined
			const projectId = runtimeContext?.get?.("project_id") as string | undefined

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context",
					error: "account_id and project_id required",
				}
			}

			const supabase = createSupabaseAdminClient()

			// Fetch current asset
			const { data: asset, error: fetchError } = await supabase
				.from("project_assets")
				.select("id, title, table_data, row_count, column_count")
				.eq("id", assetId)
				.eq("project_id", projectId)
				.single()

			if (fetchError || !asset) {
				return {
					success: false,
					message: `Table asset not found: ${assetId}`,
					error: fetchError?.message || "Asset not found",
				}
			}

			const tableData = asset.table_data as { headers: string[]; rows: Record<string, string>[] } | null
			if (!tableData) {
				return {
					success: false,
					message: "Asset has no table data",
					error: "No table_data found",
				}
			}

			let updatedHeaders = [...tableData.headers]
			let updatedRows = [...tableData.rows]

			switch (operation) {
				case "addRows": {
					if (!newRows || newRows.length === 0) {
						return { success: false, message: "No rows provided for addRows operation", error: "newRows required" }
					}
					updatedRows = [...updatedRows, ...newRows]
					consola.info(`[update-table-asset] Added ${newRows.length} rows to ${asset.title}`)
					break
				}

				case "updateRows": {
					if (!updates || updates.length === 0) {
						return { success: false, message: "No updates provided for updateRows operation", error: "updates required" }
					}
					for (const update of updates) {
						if (update.rowIndex >= 0 && update.rowIndex < updatedRows.length) {
							updatedRows[update.rowIndex] = {
								...updatedRows[update.rowIndex],
								[update.column]: update.value,
							}
						}
					}
					consola.info(`[update-table-asset] Updated ${updates.length} cells in ${asset.title}`)
					break
				}

				case "removeRows": {
					if (!rowIndices || rowIndices.length === 0) {
						return { success: false, message: "No row indices provided for removeRows operation", error: "rowIndices required" }
					}
					// Remove in reverse order to preserve indices
					const sortedIndices = [...rowIndices].sort((a, b) => b - a)
					for (const idx of sortedIndices) {
						if (idx >= 0 && idx < updatedRows.length) {
							updatedRows.splice(idx, 1)
						}
					}
					consola.info(`[update-table-asset] Removed ${rowIndices.length} rows from ${asset.title}`)
					break
				}

				case "addColumn": {
					if (!columnName) {
						return { success: false, message: "No column name provided for addColumn operation", error: "columnName required" }
					}
					updatedHeaders = [...updatedHeaders, columnName]
					updatedRows = updatedRows.map((row) => ({
						...row,
						[columnName]: defaultValue || "",
					}))
					consola.info(`[update-table-asset] Added column "${columnName}" to ${asset.title}`)
					break
				}

				case "replaceAll": {
					if (!headers || !rows) {
						return { success: false, message: "Headers and rows required for replaceAll operation", error: "headers and rows required" }
					}
					updatedHeaders = headers
					updatedRows = rows
					consola.info(`[update-table-asset] Replaced all data in ${asset.title}`)
					break
				}

				default:
					return { success: false, message: `Unknown operation: ${operation}`, error: "Invalid operation" }
			}

			// Generate updated markdown
			const markdownTable = generateMarkdownTable(updatedHeaders, updatedRows, 20)

			// Save updates
			const { error: updateError } = await supabase
				.from("project_assets")
				.update({
					table_data: { headers: updatedHeaders, rows: updatedRows },
					content_md: markdownTable,
					row_count: updatedRows.length,
					column_count: updatedHeaders.length,
					updated_at: new Date().toISOString(),
				})
				.eq("id", assetId)

			if (updateError) {
				consola.error("[update-table-asset] Update failed:", updateError)
				return {
					success: false,
					message: `Failed to update table: ${updateError.message}`,
					error: updateError.message,
				}
			}

			const assetUrl = `/a/${accountId}/${projectId}/assets/${assetId}`

			return {
				success: true,
				message: `Updated "${asset.title}" - now has ${updatedRows.length} rows and ${updatedHeaders.length} columns`,
				rowCount: updatedRows.length,
				columnCount: updatedHeaders.length,
				assetUrl,
			}
		} catch (error) {
			consola.error("[update-table-asset] Error:", error)
			return {
				success: false,
				message: "Failed to update table",
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
