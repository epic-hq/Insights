import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Parse CSV/TSV content into structured data and markdown table format.
 * Supports both raw text input and common delimiter detection.
 */

type ParsedRow = Record<string, string>

function detectDelimiter(content: string): string {
	const firstLine = content.split("\n")[0] || ""
	const tabCount = (firstLine.match(/\t/g) || []).length
	const commaCount = (firstLine.match(/,/g) || []).length
	const semicolonCount = (firstLine.match(/;/g) || []).length
	const pipeCount = (firstLine.match(/\|/g) || []).length

	const counts = [
		{ delimiter: "\t", count: tabCount },
		{ delimiter: ",", count: commaCount },
		{ delimiter: ";", count: semicolonCount },
		{ delimiter: "|", count: pipeCount },
	]

	const best = counts.reduce((a, b) => (a.count > b.count ? a : b))
	return best.count > 0 ? best.delimiter : ","
}

function parseCSVLine(line: string, delimiter: string): string[] {
	const result: string[] = []
	let current = ""
	let inQuotes = false

	for (let i = 0; i < line.length; i++) {
		const char = line[i]
		const nextChar = line[i + 1]

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				current += '"'
				i++ // Skip next quote
			} else {
				inQuotes = !inQuotes
			}
		} else if (char === delimiter && !inQuotes) {
			result.push(current.trim())
			current = ""
		} else {
			current += char
		}
	}

	result.push(current.trim())
	return result
}

function parseTabularContent(content: string, delimiter?: string): { headers: string[]; rows: ParsedRow[] } {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)

	if (lines.length === 0) {
		return { headers: [], rows: [] }
	}

	const detectedDelimiter = delimiter || detectDelimiter(content)
	const headerLine = lines[0]
	const headers = parseCSVLine(headerLine, detectedDelimiter).map((h) => h.replace(/^["']|["']$/g, "").trim())

	const rows: ParsedRow[] = []
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i], detectedDelimiter)
		const row: ParsedRow = {}

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j] || `column_${j + 1}`
			row[header] = (values[j] || "").replace(/^["']|["']$/g, "").trim()
		}

		rows.push(row)
	}

	return { headers, rows }
}

function generateMarkdownTable(headers: string[], rows: ParsedRow[], maxRows?: number): string {
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

function generateSummaryStats(headers: string[], rows: ParsedRow[]): Record<string, unknown> {
	const stats: Record<string, unknown> = {
		totalRows: rows.length,
		totalColumns: headers.length,
		columns: headers,
	}

	// Try to detect numeric columns and compute basic stats
	const numericColumns: Record<string, number[]> = {}

	for (const header of headers) {
		const values = rows.map((r) => r[header]).filter((v) => v !== undefined && v !== "")
		const numericValues = values.map((v) => Number.parseFloat(v)).filter((n) => !Number.isNaN(n))

		if (numericValues.length > values.length * 0.5) {
			// More than 50% are numeric
			numericColumns[header] = numericValues
		}
	}

	if (Object.keys(numericColumns).length > 0) {
		const columnStats: Record<string, { min: number; max: number; avg: number; count: number }> = {}

		for (const [col, values] of Object.entries(numericColumns)) {
			const sum = values.reduce((a, b) => a + b, 0)
			columnStats[col] = {
				min: Math.min(...values),
				max: Math.max(...values),
				avg: Math.round((sum / values.length) * 100) / 100,
				count: values.length,
			}
		}

		stats.numericColumnStats = columnStats
	}

	return stats
}

export const parseSpreadsheetTool = createTool({
	id: "parse-spreadsheet",
	description: `Parse CSV, TSV, or other delimited tabular data and return structured results with markdown table formatting.

Use this tool when:
- User pastes spreadsheet data or CSV content
- User asks you to analyze tabular data
- User wants to see data in a table format
- User shares data from Excel, Google Sheets, or similar

The tool will:
1. Auto-detect the delimiter (comma, tab, semicolon, pipe)
2. Parse the data into structured rows
3. Generate a markdown table for display
4. Compute basic statistics for numeric columns

Input can be raw CSV/TSV text. The first row is treated as headers.`,
	inputSchema: z.object({
		content: z.string().describe("The raw tabular data content (CSV, TSV, or pipe-delimited)"),
		delimiter: z
			.enum([",", "\t", ";", "|"])
			.optional()
			.describe("Force a specific delimiter. If not provided, auto-detects."),
		maxDisplayRows: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.default(20)
			.describe("Maximum rows to show in the markdown table (default: 20)"),
		includeStats: z.boolean().optional().default(true).describe("Include summary statistics for numeric columns"),
		saveToAssets: z.boolean().optional().default(true).describe("Save the parsed table to project_assets for future reference"),
		title: z.string().optional().describe("Optional title for the saved asset. Auto-generated if not provided."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		markdownTable: z.string().describe("Formatted markdown table for display"),
		headers: z.array(z.string()).describe("Column headers"),
		rowCount: z.number().describe("Total number of data rows"),
		columnCount: z.number().describe("Number of columns"),
		stats: z.record(z.string(), z.any()).optional().describe("Summary statistics for numeric columns"),
		sampleRows: z.array(z.record(z.string(), z.any())).optional().describe("First few rows as structured data"),
		assetId: z.string().uuid().optional().describe("ID of the saved project_asset, if saved"),
		assetSaved: z.boolean().optional().describe("Whether the asset was saved to project_assets"),
		looksLikeContacts: z.boolean().optional().describe("Whether the data appears to be contact/people data"),
		contactColumns: z.array(z.string()).optional().describe("Detected contact-related column names"),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext, writer }) => {
		try {
			const { content, delimiter, maxDisplayRows, includeStats, saveToAssets, title } = context

			// Get accountId and projectId from runtime context
			const accountId = runtimeContext?.get?.("account_id") as string | undefined
			const projectId = runtimeContext?.get?.("project_id") as string | undefined

			// Stream progress update - starting
			await writer?.custom?.({
				type: "data-tool-progress",
				data: { tool: "parseSpreadsheet", status: "parsing", message: "Parsing spreadsheet data...", progress: 10 },
			})

			if (!content || content.trim().length === 0) {
				return {
					success: false,
					message: "No content provided. Please paste your CSV or tabular data.",
					markdownTable: "",
					headers: [],
					rowCount: 0,
					columnCount: 0,
					error: "Empty content",
				}
			}

			consola.debug("[parse-spreadsheet] Parsing content", {
				contentLength: content.length,
				delimiter: delimiter || "auto-detect",
				maxDisplayRows,
			})

			const { headers, rows } = parseTabularContent(content, delimiter)

			if (headers.length === 0) {
				return {
					success: false,
					message: "Could not parse the data. Make sure it has headers in the first row.",
					markdownTable: "",
					headers: [],
					rowCount: 0,
					columnCount: 0,
					error: "No headers found",
				}
			}

			const markdownTable = generateMarkdownTable(headers, rows, maxDisplayRows)
			const stats = includeStats ? generateSummaryStats(headers, rows) : undefined

			consola.info("[parse-spreadsheet] Parsed successfully", {
				headers: headers.length,
				rows: rows.length,
			})

			// Stream progress update - parsed
			await writer?.custom?.({
				type: "data-tool-progress",
				data: { tool: "parseSpreadsheet", status: "analyzing", message: `Parsed ${rows.length} rows, analyzing data...`, progress: 50 },
			})

			// Detect if this looks like contact data
			const contactKeywords = ["name", "email", "phone", "company", "organization", "title", "role", "linkedin", "contact"]
			const contactColumns = headers.filter((h) =>
				contactKeywords.some((kw) => h.toLowerCase().includes(kw))
			)
			const looksLikeContacts = contactColumns.length >= 2

			// Save to project_assets if requested and we have the required IDs
			let assetId: string | undefined
			let assetSaved = false

			if (saveToAssets && accountId && projectId) {
				try {
					const supabaseAdmin = createSupabaseAdminClient()

					// Generate a title if not provided
					const assetTitle = title || `Table: ${headers.slice(0, 3).join(", ")}${headers.length > 3 ? "..." : ""}`

					// Stream progress update - saving
					await writer?.custom?.({
						type: "data-tool-progress",
						data: { tool: "parseSpreadsheet", status: "saving", message: `Saving ${rows.length} rows to project assets...`, progress: 70 },
					})

					// Store up to 1000 rows in table_data (display limit is separate)
					const storageRows = rows.slice(0, 1000)

					const { data: asset, error: insertError } = await supabaseAdmin
						.from("project_assets")
						.insert({
							account_id: accountId,
							project_id: projectId,
							asset_type: "table",
							title: assetTitle,
							content_md: markdownTable,
							content_raw: content, // Store original for re-parsing
							table_data: { headers, rows: storageRows },
							row_count: rows.length,
							column_count: headers.length,
							source_type: "paste",
							status: "ready",
						})
						.select("id")
						.single()

					if (insertError) {
						consola.error("[parse-spreadsheet] Failed to save asset:", insertError)
					} else if (asset) {
						assetId = asset.id
						assetSaved = true
						consola.info("[parse-spreadsheet] Saved to project_assets:", assetId)
					}
				} catch (saveError) {
					consola.error("[parse-spreadsheet] Error saving asset:", saveError)
				}
			} else if (saveToAssets && (!accountId || !projectId)) {
				consola.warn("[parse-spreadsheet] Cannot save: missing accountId or projectId")
			}

			const savedMessage = assetSaved ? " Saved to project assets." : ""
			const contactMessage = looksLikeContacts
				? ` This looks like contact data (detected: ${contactColumns.join(", ")}). Would you like me to import these as People?`
				: ""

			return {
				success: true,
				message: `Parsed ${rows.length} rows with ${headers.length} columns.${savedMessage}${contactMessage}`,
				markdownTable,
				headers,
				rowCount: rows.length,
				columnCount: headers.length,
				stats,
				sampleRows: rows.slice(0, 5), // Include first 5 rows as structured data for LLM reasoning
				assetId,
				assetSaved,
				looksLikeContacts,
				contactColumns: looksLikeContacts ? contactColumns : undefined,
			}
		} catch (error) {
			consola.error("[parse-spreadsheet] Error:", error)
			return {
				success: false,
				message: "Failed to parse the tabular data.",
				markdownTable: "",
				headers: [],
				rowCount: 0,
				columnCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
