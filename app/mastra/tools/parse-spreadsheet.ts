import { createTool } from "@mastra/core/tools";
import { tasks } from "@trigger.dev/sdk";
import consola from "consola";
import type { indexAssetTask } from "src/trigger/asset/indexAsset";
import { z } from "zod";
import { b } from "../../../baml_client";
import type { Database } from "../../database.types";
import { createSupabaseAdminClient } from "../../lib/supabase/client.server";

// Type alias for database tables
type ProjectAsset = Database["public"]["Tables"]["project_assets"]["Row"];

/**
 * Parse CSV/TSV content into structured data and markdown table format.
 * Supports both raw text input and common delimiter detection.
 */

type ParsedRow = Record<string, string>;

function detectDelimiter(content: string): string {
	const firstLine = content.split("\n")[0] || "";
	const tabCount = (firstLine.match(/\t/g) || []).length;
	const commaCount = (firstLine.match(/,/g) || []).length;
	const semicolonCount = (firstLine.match(/;/g) || []).length;
	const pipeCount = (firstLine.match(/\|/g) || []).length;

	const counts = [
		{ delimiter: "\t", count: tabCount },
		{ delimiter: ",", count: commaCount },
		{ delimiter: ";", count: semicolonCount },
		{ delimiter: "|", count: pipeCount },
	];

	const best = counts.reduce((a, b) => (a.count > b.count ? a : b));
	return best.count > 0 ? best.delimiter : ",";
}

function parseCSVLine(line: string, delimiter: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				current += '"';
				i++; // Skip next quote
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === delimiter && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

function parseTabularContent(content: string, delimiter?: string): { headers: string[]; rows: ParsedRow[] } {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length === 0) {
		return { headers: [], rows: [] };
	}

	const detectedDelimiter = delimiter || detectDelimiter(content);
	const headerLine = lines[0];
	const headers = parseCSVLine(headerLine, detectedDelimiter).map((h) => h.replace(/^["']|["']$/g, "").trim());

	const rows: ParsedRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i], detectedDelimiter);
		const row: ParsedRow = {};

		for (let j = 0; j < headers.length; j++) {
			const header = headers[j] || `column_${j + 1}`;
			row[header] = (values[j] || "").replace(/^["']|["']$/g, "").trim();
		}

		rows.push(row);
	}

	return { headers, rows };
}

function generateMarkdownTable(headers: string[], rows: ParsedRow[], maxRows?: number): string {
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

function generateSummaryStats(headers: string[], rows: ParsedRow[]): Record<string, unknown> {
	const stats: Record<string, unknown> = {
		totalRows: rows.length,
		totalColumns: headers.length,
		columns: headers,
	};

	// Try to detect numeric columns and compute basic stats
	const numericColumns: Record<string, number[]> = {};

	for (const header of headers) {
		const values = rows.map((r) => r[header]).filter((v) => v !== undefined && v !== "");
		const numericValues = values.map((v) => Number.parseFloat(v)).filter((n) => !Number.isNaN(n));

		if (numericValues.length > values.length * 0.5) {
			// More than 50% are numeric
			numericColumns[header] = numericValues;
		}
	}

	if (Object.keys(numericColumns).length > 0) {
		const columnStats: Record<string, { min: number; max: number; avg: number; count: number }> = {};

		for (const [col, values] of Object.entries(numericColumns)) {
			const sum = values.reduce((a, b) => a + b, 0);
			columnStats[col] = {
				min: Math.min(...values),
				max: Math.max(...values),
				avg: Math.round((sum / values.length) * 100) / 100,
				count: values.length,
			};
		}

		stats.numericColumnStats = columnStats;
	}

	return stats;
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
			.nullish()
			.describe("Force a specific delimiter. If not provided, auto-detects."),
		maxDisplayRows: z
			.number()
			.int()
			.min(1)
			.max(100)
			.nullish()
			.default(20)
			.describe("Maximum rows to show in the markdown table (default: 20)"),
		includeStats: z
			.boolean()
			.nullish()
			.transform((v) => v ?? true)
			.describe("Include summary statistics for numeric columns"),
		saveToAssets: z
			.boolean()
			.nullish()
			.default(true)
			.describe("Save the parsed table to project_assets for future reference"),
		title: z.string().nullish().describe("Optional title for the saved asset. Auto-generated if not provided."),
		description: z.string().nullish().describe("Description of the table contents. Auto-generated if not provided."),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		markdownTable: z.string().describe("Formatted markdown table for display"),
		headers: z.array(z.string()).describe("Column headers"),
		rowCount: z.number().describe("Total number of data rows"),
		columnCount: z.number().describe("Number of columns"),
		stats: z.record(z.string(), z.any()).nullish().describe("Summary statistics for numeric columns"),
		sampleRows: z.array(z.record(z.string(), z.any())).nullish().describe("First few rows as structured data"),
		assetId: z.string().uuid().nullish().describe("ID of the saved project_asset, if saved"),
		assetUrl: z.string().nullish().describe("Full URL to view/edit the asset (use this for links, not assetId)"),
		assetSaved: z.boolean().nullish().describe("Whether the asset was saved to project_assets"),
		looksLikeContacts: z.boolean().nullish().describe("Whether the data appears to be contact/people data"),
		contactColumns: z.array(z.string()).nullish().describe("Detected contact-related column names"),
		looksLikeOpportunities: z.boolean().nullish().describe("Whether the data appears to be opportunity/deal data"),
		opportunityColumns: z.array(z.string()).nullish().describe("Detected opportunity-related column names"),
		// LLM-analyzed column mapping for accurate imports
		columnMapping: z
			.object({
				// Name fields
				name: z.string().nullable().nullish().describe("Column with full name"),
				firstname: z.string().nullable().nullish().describe("Column with first name only"),
				lastname: z.string().nullable().nullish().describe("Column with last name only"),
				// Primary contact
				email: z.string().nullable().nullish().describe("Column with email"),
				phone: z.string().nullable().nullish().describe("Column with phone"),
				website: z.string().nullable().nullish().describe("Column with website URL"),
				address: z.string().nullable().nullish().describe("Column with full address"),
				// Social profiles
				linkedin: z.string().nullable().nullish().describe("Column with LinkedIn"),
				twitter: z.string().nullable().nullish().describe("Column with Twitter/X"),
				instagram: z.string().nullable().nullish().describe("Column with Instagram"),
				tiktok: z.string().nullable().nullish().describe("Column with TikTok"),
				// Professional info
				title: z.string().nullable().nullish().describe("Column with job title"),
				company: z.string().nullable().nullish().describe("Column with company name"),
				role: z.string().nullable().nullish().describe("Column with role/function"),
				industry: z.string().nullable().nullish().describe("Column with industry"),
				location: z.string().nullable().nullish().describe("Column with city/region"),
				// Company context
				company_stage: z.string().nullable().nullish().describe("Column with company stage"),
				company_size: z.string().nullable().nullish().describe("Column with company size"),
				// Company metrics (all optional - not required for import)
				company_url: z.string().nullable().nullish().describe("Column with company website URL"),
				annual_revenue: z.string().nullable().nullish().describe("Column with annual revenue"),
				market_cap: z.string().nullable().nullish().describe("Column with market capitalization"),
				funding_stage: z.string().nullable().nullish().describe("Column with funding stage (Seed, Series A, etc.)"),
				total_funding: z.string().nullable().nullish().describe("Column with total funding amount"),
				// Segmentation
				segment: z.string().nullable().nullish().describe("Column with segment"),
				lifecycle_stage: z.string().nullable().nullish().describe("Column with lifecycle stage"),
			})
			.nullish()
			.describe(
				"LLM-analyzed column mapping for CRM import. ONLY contains fields that were detected in the spreadsheet - unmapped fields are OMITTED (not set to null). Pass this directly to importPeopleFromTable."
			),
		suggestedFacets: z
			.array(
				z.object({
					column: z.string().describe("Column name from spreadsheet"),
					facetKind: z.string().describe("Suggested facet kind slug"),
					sampleValues: z.array(z.string()).nullish().describe("Example values from column"),
					reason: z.string().describe("Why this should be a facet"),
				})
			)
			.nullish()
			.describe("Suggested facet mappings for unmapped columns (event signups, survey answers, etc.)"),
		mappingConfidence: z.number().nullish().describe("Confidence score 0-1 for the column mapping"),
		mappingWarnings: z.array(z.string()).nullish().describe("Warnings about the data or mapping"),
		// Duplicate detection for contacts
		duplicateCheck: z
			.object({
				totalEmailsInSpreadsheet: z.number().describe("Number of emails found in spreadsheet"),
				existingEmailsInCRM: z.number().describe("Number of emails that already exist in CRM"),
				newEmails: z.number().describe("Number of new emails that would be created"),
				duplicatePercentage: z.number().describe("Percentage of emails that are duplicates (0-100)"),
			})
			.nullish()
			.describe("Duplicate detection results - helps decide between create vs upsert mode"),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const writer = context?.writer;
			const { content, delimiter, maxDisplayRows, includeStats, saveToAssets, title, description } = input;

			// Get accountId and projectId from runtime context
			const accountId = context?.requestContext?.get?.("account_id") as string | undefined;
			const projectId = context?.requestContext?.get?.("project_id") as string | undefined;

			// Stream progress update - starting
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "parseSpreadsheet",
					status: "parsing",
					message: "Parsing spreadsheet data...",
					progress: 10,
				},
			});

			if (!content || content.trim().length === 0) {
				consola.warn("[parse-spreadsheet] Empty content received");
				return {
					success: false,
					message: "No content provided. Please paste your CSV or tabular data.",
					markdownTable: "",
					headers: [],
					rowCount: 0,
					columnCount: 0,
					error: "Empty content",
				};
			}

			// Log content details for debugging
			const contentPreview = content.slice(0, 200);
			const lineCount = content.split(/\r?\n/).filter((l) => l.trim()).length;
			const detectedDelim = detectDelimiter(content);

			consola.info("[parse-spreadsheet] Parsing content", {
				contentLength: content.length,
				lineCount,
				detectedDelimiter: detectedDelim === "\t" ? "TAB" : detectedDelim,
				delimiter: delimiter || "auto-detect",
				maxDisplayRows,
				contentPreview: contentPreview.replace(/\t/g, "→").replace(/\n/g, "↵"),
			});

			const { headers, rows } = parseTabularContent(content, delimiter);

			if (headers.length === 0) {
				consola.warn("[parse-spreadsheet] No headers found", {
					contentPreview: contentPreview.replace(/\t/g, "→").replace(/\n/g, "↵"),
					detectedDelimiter: detectedDelim,
					lineCount,
				});
				return {
					success: false,
					message: `Could not parse the data. Found ${lineCount} line(s) but no column headers detected. Detected delimiter: ${detectedDelim === "\t" ? "tab" : detectedDelim}. Make sure your data has headers in the first row, separated by tabs or commas.`,
					markdownTable: "",
					headers: [],
					rowCount: 0,
					columnCount: 0,
					error: "No headers found",
				};
			}

			const markdownTable = generateMarkdownTable(headers, rows, maxDisplayRows);
			const stats = includeStats ? generateSummaryStats(headers, rows) : undefined;

			consola.info("[parse-spreadsheet] Parsed successfully", {
				headers: headers.length,
				rows: rows.length,
			});

			// Stream progress update - parsed
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "parseSpreadsheet",
					status: "analyzing",
					message: `Parsed ${rows.length} rows, analyzing data...`,
					progress: 50,
				},
			});

			// Detect if this looks like contact data
			const contactKeywords = [
				"name",
				"email",
				"phone",
				"company",
				"organization",
				"title",
				"role",
				"linkedin",
				"contact",
			];
			const contactColumns = headers.filter((h) => contactKeywords.some((kw) => h.toLowerCase().includes(kw)));
			const looksLikeContacts = contactColumns.length >= 2;

			// Use LLM to analyze column mapping for contact data
			let columnMapping: Record<string, string | null> | undefined;
			let suggestedFacets: Array<{ column: string; facetKind: string; reason: string }> | undefined;
			let mappingConfidence: number | undefined;
			let mappingWarnings: string[] | undefined;

			if (looksLikeContacts) {
				try {
					await writer?.custom?.({
						type: "data-tool-progress",
						data: {
							tool: "parseSpreadsheet",
							status: "analyzing",
							message: "Analyzing columns with AI for accurate mapping...",
							progress: 55,
						},
					});

					// Prepare sample rows as string arrays for the LLM
					const sampleRowsForLLM = rows.slice(0, 5).map((row) => headers.map((h) => row[h] || ""));

					const analysis = await b.MapSpreadsheetColumns(
						headers,
						sampleRowsForLLM,
						null // No additional context
					);

					// Convert the mapping to the expected format
					// IMPORTANT: Only include fields that have actual mappings
					// Do NOT include null values - omit unmapped fields entirely
					// This ensures importPeopleFromTable only updates fields present in the spreadsheet
					const rawMapping: Record<string, string | undefined> = {
						name: analysis.column_mapping.name,
						firstname: analysis.column_mapping.firstname,
						lastname: analysis.column_mapping.lastname,
						email: analysis.column_mapping.email,
						phone: analysis.column_mapping.phone,
						website: analysis.column_mapping.website,
						address: analysis.column_mapping.address,
						linkedin: analysis.column_mapping.linkedin,
						twitter: analysis.column_mapping.twitter,
						instagram: analysis.column_mapping.instagram,
						tiktok: analysis.column_mapping.tiktok,
						title: analysis.column_mapping.title,
						company: analysis.column_mapping.company,
						role: analysis.column_mapping.role,
						industry: analysis.column_mapping.industry,
						location: analysis.column_mapping.location,
						company_stage: analysis.column_mapping.company_stage,
						company_size: analysis.column_mapping.company_size,
						company_url: analysis.column_mapping.company_url,
						annual_revenue: analysis.column_mapping.annual_revenue,
						market_cap: analysis.column_mapping.market_cap,
						funding_stage: analysis.column_mapping.funding_stage,
						total_funding: analysis.column_mapping.total_funding,
						segment: analysis.column_mapping.segment,
						lifecycle_stage: analysis.column_mapping.lifecycle_stage,
					};
					// Filter out undefined/null values - only keep actual mappings
					columnMapping = Object.fromEntries(
						Object.entries(rawMapping).filter(([_, v]) => v != null && v !== "")
					) as Record<string, string>;
					suggestedFacets = analysis.suggested_facets.map((f) => ({
						column: f.column,
						facetKind: f.facet_kind,
						sampleValues: f.sample_values || [],
						reason: f.reason,
					}));
					mappingConfidence = analysis.confidence;
					mappingWarnings = analysis.warnings;

					consola.info("[parse-spreadsheet] LLM column mapping:", columnMapping);
					consola.info("[parse-spreadsheet] Mapping confidence:", mappingConfidence);

					// Add warnings for missing important columns
					if (!mappingWarnings) mappingWarnings = [];
					if (!columnMapping.company) {
						mappingWarnings.push("No company column detected - people will be imported without company associations");
					}
					if (!columnMapping.email) {
						mappingWarnings.push("No email column detected - duplicate detection and upsert mode won't work");
					}
					if (!columnMapping.name && !columnMapping.firstname && !columnMapping.lastname) {
						mappingWarnings.push("No name columns detected - import may fail without names");
					}
				} catch (llmError) {
					consola.error("[parse-spreadsheet] LLM mapping failed, falling back to pattern matching:", llmError);
					// Fall back to basic pattern matching (existing behavior)
				}
			}

			// Check for duplicates in CRM if we have contact data with emails
			let duplicateCheck:
				| {
						totalEmailsInSpreadsheet: number;
						existingEmailsInCRM: number;
						newEmails: number;
						duplicatePercentage: number;
				  }
				| undefined;

			const emailColumn = columnMapping?.email;
			if (looksLikeContacts && emailColumn && projectId) {
				try {
					await writer?.custom?.({
						type: "data-tool-progress",
						data: {
							tool: "parseSpreadsheet",
							status: "checking",
							message: "Checking for existing contacts in CRM...",
							progress: 60,
						},
					});

					// Extract emails from spreadsheet
					const spreadsheetEmails = rows
						.map((row) => row[emailColumn]?.toLowerCase()?.trim())
						.filter((email): email is string => !!email && email.includes("@"));
					const uniqueSpreadsheetEmails = [...new Set(spreadsheetEmails)];

					if (uniqueSpreadsheetEmails.length > 0) {
						const supabaseAdmin = createSupabaseAdminClient();

						// Query existing emails in CRM
						const { data: existingPeople } = await supabaseAdmin
							.from("people")
							.select("primary_email")
							.eq("project_id", projectId)
							.not("primary_email", "is", null);

						const existingEmailSet = new Set(
							(existingPeople || []).map((p) => p.primary_email?.toLowerCase()?.trim()).filter(Boolean)
						);

						const existingCount = uniqueSpreadsheetEmails.filter((email) => existingEmailSet.has(email)).length;

						duplicateCheck = {
							totalEmailsInSpreadsheet: uniqueSpreadsheetEmails.length,
							existingEmailsInCRM: existingCount,
							newEmails: uniqueSpreadsheetEmails.length - existingCount,
							duplicatePercentage: Math.round((existingCount / uniqueSpreadsheetEmails.length) * 100),
						};

						consola.info("[parse-spreadsheet] Duplicate check:", duplicateCheck);
					}
				} catch (dupError) {
					consola.warn("[parse-spreadsheet] Failed to check duplicates:", dupError);
				}
			}

			// Detect if this looks like opportunity/deal data
			const opportunityKeywords = [
				"deal",
				"opportunity",
				"amount",
				"value",
				"revenue",
				"stage",
				"pipeline",
				"close",
				"forecast",
				"probability",
				"confidence",
				"account",
				"prospect",
			];
			const opportunityColumns = headers.filter((h) => opportunityKeywords.some((kw) => h.toLowerCase().includes(kw)));
			// Needs at least a deal/opportunity name indicator AND a value/stage indicator
			const hasOpportunityName = headers.some((h) =>
				["deal", "opportunity", "account", "prospect", "name", "title"].some((kw) => h.toLowerCase().includes(kw))
			);
			const hasOpportunityValue = headers.some((h) =>
				["amount", "value", "revenue", "stage", "pipeline", "close", "forecast"].some((kw) =>
					h.toLowerCase().includes(kw)
				)
			);
			const looksLikeOpportunities = hasOpportunityName && hasOpportunityValue && opportunityColumns.length >= 2;

			// Save to project_assets if requested and we have the required IDs
			let assetId: string | undefined;
			let assetUrl: string | undefined;
			let assetSaved = false;

			if (saveToAssets && accountId && projectId) {
				try {
					const supabaseAdmin = createSupabaseAdminClient();

					// Generate a title if not provided
					const assetTitle = title || `Table: ${headers.slice(0, 3).join(", ")}${headers.length > 3 ? "..." : ""}`;

					// Stream progress update - saving
					await writer?.custom?.({
						type: "data-tool-progress",
						data: {
							tool: "parseSpreadsheet",
							status: "saving",
							message: `Saving ${rows.length} rows to project assets...`,
							progress: 70,
						},
					});

					// Store up to 1000 rows in table_data (display limit is separate)
					const storageRows = rows.slice(0, 1000);

					// Generate a description if not provided
					const assetDescription =
						description ||
						`Imported table with ${rows.length} rows and ${headers.length} columns. Columns: ${headers.slice(0, 5).join(", ")}${headers.length > 5 ? "..." : ""}`;

					const { data: asset, error: insertError } = (await (supabaseAdmin as any)
						.from("project_assets")
						.insert({
							account_id: accountId,
							project_id: projectId,
							asset_type: "table",
							title: assetTitle,
							description: assetDescription,
							content_md: markdownTable,
							content_raw: content, // Store original for re-parsing
							table_data: { headers, rows: storageRows },
							row_count: rows.length,
							column_count: headers.length,
							source_type: "paste",
							status: "ready",
						})
						.select("*")
						.single()) as { data: ProjectAsset | null; error: Error | null };

					if (insertError || !asset) {
						consola.error("[parse-spreadsheet] Failed to save asset:", insertError);
					} else {
						assetId = asset.id;
						assetUrl = `/a/${accountId}/${projectId}/assets/${asset.id}`;
						assetSaved = true;
						consola.info("[parse-spreadsheet] Saved to project_assets:", assetId);

						// Trigger embedding generation in background
						try {
							await tasks.trigger<typeof indexAssetTask>("asset.index", {
								assetId: asset.id,
							});
							consola.info("[parse-spreadsheet] Triggered embedding generation for", asset.id);
						} catch (triggerError) {
							consola.warn("[parse-spreadsheet] Failed to trigger indexing:", triggerError);
						}
					}
				} catch (saveError) {
					consola.error("[parse-spreadsheet] Error saving asset:", saveError);
				}
			} else if (saveToAssets && (!accountId || !projectId)) {
				consola.warn("[parse-spreadsheet] Cannot save: missing accountId or projectId");
			}

			const savedMessage = assetSaved ? " Saved to project assets." : "";

			// Build duplicate message if we found existing contacts
			let duplicateMessage = "";
			if (duplicateCheck && duplicateCheck.existingEmailsInCRM > 0) {
				duplicateMessage = ` Found ${duplicateCheck.existingEmailsInCRM} of ${duplicateCheck.totalEmailsInSpreadsheet} emails already in CRM (${duplicateCheck.duplicatePercentage}% overlap).`;
				if (duplicateCheck.duplicatePercentage > 30) {
					duplicateMessage += " Consider using UPSERT mode to update existing contacts with new data.";
				}
			}

			const contactMessage = looksLikeContacts
				? ` This looks like contact data (detected: ${contactColumns.join(", ")}).${duplicateMessage} Would you like me to import these as People?`
				: "";
			const opportunityMessage =
				looksLikeOpportunities && !looksLikeContacts
					? ` This looks like opportunity/deal data (detected: ${opportunityColumns.join(", ")}). Would you like me to import these as Opportunities?`
					: "";

			// Add mapping info to message if available
			const mappingMessage =
				columnMapping && mappingConfidence
					? ` AI analyzed columns with ${Math.round(mappingConfidence * 100)}% confidence.`
					: "";

			return {
				success: true,
				message: `Parsed ${rows.length} rows with ${headers.length} columns.${savedMessage}${mappingMessage}${contactMessage}${opportunityMessage}`,
				markdownTable,
				headers,
				rowCount: rows.length,
				columnCount: headers.length,
				stats,
				sampleRows: rows.slice(0, 5), // Include first 5 rows as structured data for LLM reasoning
				assetId,
				assetUrl,
				assetSaved,
				looksLikeContacts,
				contactColumns: looksLikeContacts ? contactColumns : undefined,
				looksLikeOpportunities,
				opportunityColumns: looksLikeOpportunities ? opportunityColumns : undefined,
				// LLM-analyzed column mapping - USE THIS for importPeopleFromTable
				columnMapping,
				suggestedFacets,
				mappingConfidence,
				mappingWarnings,
				// Duplicate detection - helps decide between create vs upsert mode
				duplicateCheck,
			};
		} catch (error) {
			consola.error("[parse-spreadsheet] Error:", error);
			return {
				success: false,
				message: "Failed to parse the tabular data.",
				markdownTable: "",
				headers: [],
				rowCount: 0,
				columnCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});
