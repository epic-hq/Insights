import { createTool } from "@mastra/core/tools"
import { tasks } from "@trigger.dev/sdk"
import consola from "consola"
import { z } from "zod"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import type { indexAssetTask } from "src/trigger/asset/indexAsset"

/**
 * Save agent-generated tabular data to project_assets.
 *
 * This tool is for when the agent GENERATES structured table data (competitive matrices,
 * feature comparisons, etc.) and needs to save it with inline editing capability.
 *
 * For user-pasted CSV/TSV data, use parseSpreadsheet instead.
 */

function generateMarkdownTable(headers: string[], rows: Record<string, string>[], maxRows?: number): string {
	if (headers.length === 0) return "*No data to display*"

	const displayRows = maxRows ? rows.slice(0, maxRows) : rows
	const lines: string[] = []

	// Header row
	lines.push(`| ${headers.join(" | ")} |`)

	// Separator row
	lines.push(`| ${headers.map(() => "---").join(" | ")} |`)

	// Data rows
	for (const row of displayRows) {
		const values = headers.map((h) => {
			const val = row[h] || ""
			// Escape pipe characters in cell values
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

export const saveTableToAssetsTool = createTool({
	id: "saveTableToAssets",
	description: `CREATE a NEW table in project_assets. ONLY use when user explicitly asks to create a new table.

⚠️ DO NOT use this to modify existing tables - use "updateTableAsset" instead!
- If user says "add a row" to an existing table → use updateTableAsset
- If user says "create a competitive matrix" → use this tool

REQUIRED PARAMETERS:
- title: string (e.g., "Competitive Matrix")
- headers: string[] (column names)
- rows: array of objects with keys matching headers (THE DATA - REQUIRED!)

EXAMPLE CALL:
{
  "title": "Competitive Matrix",
  "headers": ["Feature", "Us", "Competitor A"],
  "rows": [
    {"Feature": "Pricing", "Us": "$10/mo", "Competitor A": "$15/mo"},
    {"Feature": "API Access", "Us": "Yes", "Competitor A": "No"},
    {"Feature": "Support", "Us": "24/7", "Competitor A": "Business hours"}
  ]
}

The saved asset appears in "Files" tab with inline cell editing, sorting, search, and CSV export.`,
	inputSchema: z.object({
		title: z.string().describe("Title for the table/asset"),
		description: z.string().optional().describe("Description of the table contents"),
		headers: z.array(z.string()).describe("Column headers - e.g., ['Feature', 'Us', 'Competitor A']"),
		rows: z.array(z.record(z.string(), z.string())).describe("REQUIRED: Array of row objects. Each row is an object with keys matching headers. Example: [{Feature: 'Pricing', Us: '$10', 'Competitor A': '$15'}]"),
		kind: z.string().optional().describe("Category (e.g., 'competitive_matrix', 'feature_comparison')"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		assetId: z.string().uuid().optional().describe("ID of the created asset"),
		assetUrl: z.string().optional().describe("URL to view/edit the table"),
		markdownTable: z.string().optional().describe("Markdown preview of the table (first 20 rows)"),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const { title, description, headers, rows, kind } = context

			// Get accountId and projectId from runtime context
			const accountId = runtimeContext?.get?.("account_id") as string | undefined
			const projectId = runtimeContext?.get?.("project_id") as string | undefined

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context. Cannot save table.",
					error: "account_id and project_id required",
				}
			}

			if (headers.length === 0) {
				return {
					success: false,
					message: "No headers provided. Tables must have at least one column.",
					error: "Empty headers",
				}
			}

			consola.info(`[save-table-to-assets] Saving table "${title}" with ${rows.length} rows`)

			// Generate markdown preview
			const markdownTable = generateMarkdownTable(headers, rows, 20)

			// Generate description if not provided
			const assetDescription = description ||
				`${kind ? `${kind}: ` : ""}Table with ${rows.length} rows and ${headers.length} columns. Columns: ${headers.slice(0, 5).join(", ")}${headers.length > 5 ? "..." : ""}`

			const supabaseAdmin = createSupabaseAdminClient()

			// Store up to 1000 rows
			const storageRows = rows.slice(0, 1000)

			const { data: asset, error: insertError } = await supabaseAdmin
				.from("project_assets")
				.insert({
					account_id: accountId,
					project_id: projectId,
					asset_type: "table",
					title,
					description: assetDescription,
					content_md: markdownTable,
					table_data: { headers, rows: storageRows },
					row_count: rows.length,
					column_count: headers.length,
					source_type: "ai_generated",
					status: "ready",
				})
				.select("id")
				.single()

			if (insertError) {
				consola.error("[save-table-to-assets] Insert failed:", insertError)
				return {
					success: false,
					message: `Failed to save table: ${insertError.message}`,
					error: insertError.message,
				}
			}

			const assetUrl = `/a/${accountId}/${projectId}/assets/${asset.id}`

			consola.info(`[save-table-to-assets] Saved to project_assets: ${asset.id}`)

			// Trigger embedding generation in background
			try {
				await tasks.trigger<typeof indexAssetTask>("asset.index", { assetId: asset.id })
				consola.info(`[save-table-to-assets] Triggered embedding generation for ${asset.id}`)
			} catch (triggerError) {
				// Don't fail the save if trigger fails
				consola.warn(`[save-table-to-assets] Failed to trigger indexing:`, triggerError)
			}

			return {
				success: true,
				message: `Saved "${title}" with ${rows.length} rows. You can view and edit it in the Files tab.`,
				assetId: asset.id,
				assetUrl,
				markdownTable,
			}
		} catch (error) {
			consola.error("[save-table-to-assets] Error:", error)
			return {
				success: false,
				message: "Failed to save table",
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
