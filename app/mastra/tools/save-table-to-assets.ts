import { createTool } from "@mastra/core/tools";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { indexAssetTask } from "src/trigger/asset/indexAsset";
import { z } from "zod";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

/**
 * Save agent-generated tabular data to project_assets.
 *
 * This tool is for when the agent GENERATES structured table data (competitive matrices,
 * feature comparisons, etc.) and needs to save it with inline editing capability.
 *
 * For user-pasted CSV/TSV data, use parseSpreadsheet instead.
 */

function generateMarkdownTable(headers: string[], rows: Record<string, string>[], maxRows?: number): string {
	if (headers.length === 0) return "*No data to display*";

	const displayRows = maxRows ? rows.slice(0, maxRows) : rows;
	const lines: string[] = [];

	// Header row
	lines.push(`| ${headers.join(" | ")} |`);

	// Separator row
	lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

	// Data rows
	for (const row of displayRows) {
		const values = headers.map((h) => {
			const val = row[h] || "";
			// Escape pipe characters in cell values
			return val.replace(/\|/g, "\\|");
		});
		lines.push(`| ${values.join(" | ")} |`);
	}

	if (maxRows && rows.length > maxRows) {
		lines.push("");
		lines.push(`*...and ${rows.length - maxRows} more rows*`);
	}

	return lines.join("\n");
}

export const saveTableToAssetsTool = createTool({
	id: "saveTableToAssets",
	description: `CREATE a NEW table in project_assets. ONLY use when user explicitly asks to create a new table.

⚠️ DO NOT use this to modify existing tables - use "updateTableAsset" instead!

**CRITICAL: You MUST provide the "rows" parameter with actual data!**

REQUIRED PARAMETERS (all 3 are mandatory):
1. title: string
2. headers: string[] (column names)
3. rows: array of objects ← THIS IS THE DATA, DO NOT OMIT!

CORRECT EXAMPLE:
{
  "title": "Competitive Matrix",
  "headers": ["Tool", "Use Case", "Price"],
  "rows": [
    {"Tool": "Notion", "Use Case": "Notes", "Price": "$10/mo"},
    {"Tool": "Confluence", "Use Case": "Docs", "Price": "$5/user"},
    {"Tool": "Coda", "Use Case": "Hybrid", "Price": "$12/mo"}
  ]
}

WRONG (missing rows - WILL FAIL):
{
  "title": "Competitive Matrix",
  "headers": ["Tool", "Use Case", "Price"]
}`,
	inputSchema: z.object({
		title: z.string().describe("Title for the table/asset"),
		headers: z.array(z.string()).min(1).describe("Column headers array - e.g., ['Tool', 'Use Case', 'Price']"),
		rows: z
			.array(z.record(z.string(), z.string()))
			.min(1)
			.describe(
				"THE DATA ROWS (REQUIRED!) - Array of objects where each object has keys matching headers. Example: [{'Tool': 'Notion', 'Use Case': 'Notes', 'Price': '$10'}]"
			),
		description: z.string().nullish().describe("Optional description of the table contents"),
		kind: z.string().nullish().describe("Optional category (e.g., 'competitive_matrix')"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		assetId: z.string().uuid().nullish().describe("ID of the created asset"),
		assetUrl: z.string().nullish().describe("URL to view/edit the table"),
		markdownTable: z.string().nullish().describe("Markdown preview of the table (first 20 rows)"),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const { title, description, headers, rows, kind } = input;

			// Get accountId and projectId from runtime context
			const accountId = context?.requestContext?.get?.("account_id") as string | undefined;
			const projectId = context?.requestContext?.get?.("project_id") as string | undefined;

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context. Cannot save table.",
					error: "account_id and project_id required",
				};
			}

			if (headers.length === 0) {
				return {
					success: false,
					message: "No headers provided. Tables must have at least one column.",
					error: "Empty headers",
				};
			}

			consola.info(`[save-table-to-assets] Saving table "${title}" with ${rows.length} rows`);

			// Generate markdown preview
			const markdownTable = generateMarkdownTable(headers, rows, 20);

			// Generate description if not provided
			const assetDescription =
				description ||
				`${kind ? `${kind}: ` : ""}Table with ${rows.length} rows and ${headers.length} columns. Columns: ${headers.slice(0, 5).join(", ")}${headers.length > 5 ? "..." : ""}`;

			const supabaseAdmin = createSupabaseAdminClient();

			// Store up to 1000 rows
			const storageRows = rows.slice(0, 1000);

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
				.single();

			if (insertError) {
				consola.error("[save-table-to-assets] Insert failed:", insertError);
				return {
					success: false,
					message: `Failed to save table: ${insertError.message}`,
					error: insertError.message,
				};
			}

			const assetUrl = `/a/${accountId}/${projectId}/assets/${asset.id}`;

			consola.info(`[save-table-to-assets] Saved to project_assets: ${asset.id}`);

			// Trigger embedding generation in background
			try {
				await tasks.trigger<typeof indexAssetTask>("asset.index", { assetId: asset.id });
				consola.info(`[save-table-to-assets] Triggered embedding generation for ${asset.id}`);
			} catch (triggerError) {
				// Don't fail the save if trigger fails
				consola.warn("[save-table-to-assets] Failed to trigger indexing:", triggerError);
			}

			return {
				success: true,
				message: `Saved "${title}" with ${rows.length} rows. You can view and edit it in the Files tab.`,
				assetId: asset.id,
				assetUrl,
				markdownTable,
			};
		} catch (error) {
			consola.error("[save-table-to-assets] Error:", error);
			return {
				success: false,
				message: "Failed to save table",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
