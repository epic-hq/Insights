import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { createSupabaseAdminClient } from "../../lib/supabase/client.server";

/**
 * Column mapping schema - maps spreadsheet columns to opportunity fields
 */
const columnMappingSchema = z.object({
	// Required - deal/opportunity name
	name: z.string().nullish().describe("Column name containing deal/opportunity name"),
	title: z.string().nullish().describe("Column name containing deal title"),

	// Value/Amount
	amount: z.string().nullish().describe("Column name containing deal amount/value"),
	currency: z.string().nullish().describe("Column name containing currency"),

	// Stage/Pipeline
	stage: z.string().nullish().describe("Column name containing deal stage"),
	pipeline: z.string().nullish().describe("Column name containing pipeline name"),
	forecast_category: z.string().nullish().describe("Column name containing forecast category"),

	// Dates
	close_date: z.string().nullish().describe("Column name containing expected close date"),
	created_date: z.string().nullish().describe("Column name containing created date"),

	// Probability/Confidence
	probability: z.string().nullish().describe("Column name containing win probability"),
	confidence: z.string().nullish().describe("Column name containing confidence score"),

	// Related entities
	account: z.string().nullish().describe("Column name containing account/company name"),
	contact: z.string().nullish().describe("Column name containing primary contact name"),
	contact_email: z.string().nullish().describe("Column name containing contact email"),
	owner: z.string().nullish().describe("Column name containing deal owner"),

	// Additional info
	description: z.string().nullish().describe("Column name containing description"),
	next_step: z.string().nullish().describe("Column name containing next step"),
	source: z.string().nullish().describe("Column name containing lead source"),
	crm_id: z.string().nullish().describe("Column name containing external CRM ID"),
});

type ColumnMapping = z.infer<typeof columnMappingSchema>;

interface TableRow {
	[key: string]: unknown;
}

interface ImportResult {
	opportunityId: string;
	title: string;
	amount?: number;
	stage?: string;
	organizationId?: string;
	organizationName?: string;
	rowIndex: number;
}

/**
 * Normalize column name for matching (lowercase, trim, remove special chars)
 */
function normalizeColumnName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]/g, "");
}

/**
 * Auto-detect column mappings from headers
 */
function autoDetectMappings(headers: string[]): ColumnMapping {
	const mapping: ColumnMapping = {};
	const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeColumnName(h) }));

	const patterns: Record<keyof ColumnMapping, string[]> = {
		name: ["dealname", "opportunityname", "deal", "opportunity"],
		title: ["title", "name", "dealname"],
		amount: ["amount", "value", "dealvalue", "revenue", "price", "total", "dealamount"],
		currency: ["currency", "curr"],
		stage: ["stage", "dealstage", "status", "phase"],
		pipeline: ["pipeline", "pipelinename"],
		forecast_category: ["forecast", "forecastcategory", "category"],
		close_date: ["closedate", "expectedclose", "closingdate", "close", "expectedclosedate"],
		created_date: ["createddate", "createdat", "created", "dateadded"],
		probability: ["probability", "winprobability", "prob", "winrate"],
		confidence: ["confidence", "confidencescore", "score"],
		account: ["account", "accountname", "company", "organization", "org", "customer"],
		contact: ["contact", "contactname", "primarycontact", "person"],
		contact_email: ["contactemail", "email", "primaryemail"],
		owner: ["owner", "dealowner", "rep", "salesrep", "assignedto", "assignee"],
		description: ["description", "notes", "details", "summary"],
		next_step: ["nextstep", "nextsteps", "nextaction", "action"],
		source: ["source", "leadsource", "origin", "channel"],
		crm_id: ["crmid", "externalid", "salesforceid", "hubspotid", "dealid", "id"],
	};

	for (const [field, fieldPatterns] of Object.entries(patterns)) {
		for (const header of normalizedHeaders) {
			if (fieldPatterns.some((p) => header.normalized.includes(p))) {
				mapping[field as keyof ColumnMapping] = header.original;
				break;
			}
		}
	}

	return mapping;
}

/**
 * Extract value from row using column mapping
 */
function getValue(row: TableRow, columnName: string | undefined): string | null {
	if (!columnName) return null;
	const value = row[columnName];
	if (value === null || value === undefined || value === "") return null;
	return String(value).trim();
}

/**
 * Parse amount string to number
 */
function parseAmount(value: string | null): number | null {
	if (!value) return null;
	// Remove currency symbols, commas, spaces
	const cleaned = value.replace(/[$€£¥,\s]/g, "");
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? null : num;
}

/**
 * Parse date string to ISO date
 */
function parseDate(value: string | null): string | null {
	if (!value) return null;
	try {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		return date.toISOString().split("T")[0]; // Return YYYY-MM-DD
	} catch {
		return null;
	}
}

/**
 * Parse probability/confidence to decimal (0-1)
 */
function parseProbability(value: string | null): number | null {
	if (!value) return null;
	// Remove % sign if present
	const cleaned = value.replace(/%/g, "").trim();
	const num = Number.parseFloat(cleaned);
	if (Number.isNaN(num)) return null;
	// If > 1, assume it's a percentage and convert to decimal
	return num > 1 ? num / 100 : num;
}

export const importOpportunitiesFromTableTool = createTool({
	id: "import-opportunities-from-table",
	description: `Import opportunities/deals from a previously parsed spreadsheet table into the opportunities table.

Use this tool when:
- User has pasted deal/opportunity data and wants to import it
- parseSpreadsheet returned looksLikeOpportunities: true and user confirms import
- User explicitly asks to import deals or opportunities

The tool will:
1. Fetch the table data from project_assets using the assetId
2. Auto-detect column mappings (or use provided mappings)
3. Create opportunity records
4. Optionally create/link organizations from account column
5. Skip duplicates based on CRM external ID if provided

Requires the assetId from a previous parseSpreadsheet call.`,
	inputSchema: z.object({
		assetId: z.string().uuid().describe("The project_asset ID from parseSpreadsheet result"),
		columnMapping: columnMappingSchema
			.nullish()
			.describe("Optional explicit column mappings. If not provided, auto-detects."),
		createOrganizations: z
			.boolean()
			.nullish()
			.default(true)
			.describe("Create organizations from account column if they don't exist"),
		skipDuplicates: z.boolean().optional().default(true).describe("Skip rows where CRM external ID already exists"),
		defaultStage: z.string().nullish().describe("Default stage for opportunities without a stage column"),
		defaultCurrency: z.string().optional().default("USD").describe("Default currency if not specified in data"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		imported: z.number().describe("Number of opportunities imported"),
		skipped: z.number().describe("Number of rows skipped (duplicates or invalid)"),
		organizationsCreated: z.number().describe("Number of new organizations created"),
		results: z
			.array(
				z.object({
					opportunityId: z.string(),
					title: z.string(),
					amount: z.number().optional(),
					stage: z.string().optional(),
					organizationId: z.string().optional(),
					organizationName: z.string().optional(),
					rowIndex: z.number(),
				})
			)
			.nullish()
			.describe("Details of imported opportunities"),
		errors: z.array(z.string()).nullish().describe("Any errors encountered"),
	}),
	execute: async (input, context?) => {
		const errors: string[] = [];
		const results: ImportResult[] = [];
		let skipped = 0;
		let organizationsCreated = 0;

		try {
			const writer = context?.writer;
			const { assetId, columnMapping, createOrganizations, skipDuplicates, defaultStage, defaultCurrency } = input;

			// Get accountId and projectId from runtime context
			const accountId = context?.requestContext?.get?.("account_id") as string | undefined;
			const projectId = context?.requestContext?.get?.("project_id") as string | undefined;

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context. Cannot import opportunities.",
					imported: 0,
					skipped: 0,
					organizationsCreated: 0,
					errors: ["Missing accountId or projectId in runtime context"],
				};
			}

			const supabaseAdmin = createSupabaseAdminClient();

			// Fetch the asset with table data
			const { data: asset, error: assetError } = await supabaseAdmin
				.from("project_assets" as any)
				.select("id, title, table_data")
				.eq("id" as any, assetId)
				.single();

			if (assetError || !asset) {
				return {
					success: false,
					message: `Could not find asset with ID ${assetId}`,
					imported: 0,
					skipped: 0,
					organizationsCreated: 0,
					errors: [assetError?.message || "Asset not found"],
				};
			}

			const tableData = (asset as any).table_data as { headers: string[]; rows: TableRow[] } | null;
			if (!tableData || !tableData.headers || !tableData.rows) {
				return {
					success: false,
					message: "Asset does not contain valid table data",
					imported: 0,
					skipped: 0,
					organizationsCreated: 0,
					errors: ["No table_data found in asset"],
				};
			}

			const { headers, rows } = tableData;
			consola.info(`[import-opportunities] Processing ${rows.length} rows from asset ${assetId}`);

			// Stream progress - starting
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "importOpportunitiesFromTable",
					status: "starting",
					message: `Importing ${rows.length} opportunities...`,
					progress: 10,
				},
			});

			// Auto-detect or use provided mappings
			const mapping = columnMapping || autoDetectMappings(headers);
			consola.debug("[import-opportunities] Column mapping:", mapping);

			// Get title column - try name first, then title
			const titleColumn = mapping.name || mapping.title;
			if (!titleColumn) {
				return {
					success: false,
					message: "Could not detect opportunity name/title column. Please provide column mapping.",
					imported: 0,
					skipped: 0,
					organizationsCreated: 0,
					errors: ["No name or title column detected"],
				};
			}

			// Fetch existing opportunities by CRM ID for duplicate detection
			const existingCrmIds = new Set<string>();
			if (skipDuplicates && mapping.crm_id) {
				const { data: existingOpps } = await supabaseAdmin
					.from("opportunities")
					.select("crm_external_id")
					.eq("project_id", projectId)
					.not("crm_external_id", "is", null);

				if (existingOpps) {
					for (const opp of existingOpps) {
						if (opp.crm_external_id) {
							existingCrmIds.add(opp.crm_external_id);
						}
					}
				}
			}

			// Cache for organizations to avoid duplicate lookups/creates
			const orgCache = new Map<string, string>(); // name -> id

			// Process each row
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i];

				// Stream progress every 10 rows or on first/last row
				if (i === 0 || i === rows.length - 1 || i % 10 === 0) {
					const progress = Math.round(10 + (i / rows.length) * 70); // 10-80%
					await writer?.custom?.({
						type: "data-tool-progress",
						data: {
							tool: "importOpportunitiesFromTable",
							status: "importing",
							message: `Processing opportunity ${i + 1} of ${rows.length}...`,
							progress,
						},
					});
				}

				try {
					const title = getValue(row, titleColumn);
					if (!title) {
						skipped++;
						continue;
					}

					// Check for duplicate by CRM ID
					const crmId = getValue(row, mapping.crm_id);
					if (skipDuplicates && crmId && existingCrmIds.has(crmId)) {
						consola.debug(`[import-opportunities] Skipping duplicate CRM ID: ${crmId}`);
						skipped++;
						continue;
					}

					// Parse values
					const amount = parseAmount(getValue(row, mapping.amount));
					const stage = getValue(row, mapping.stage) || defaultStage || null;
					const closeDate = parseDate(getValue(row, mapping.close_date));
					const confidence = parseProbability(getValue(row, mapping.probability) || getValue(row, mapping.confidence));
					const description = getValue(row, mapping.description);
					const nextStep = getValue(row, mapping.next_step);
					const source = getValue(row, mapping.source);
					const currency = getValue(row, mapping.currency) || defaultCurrency;

					// Handle organization
					let organizationId: string | null = null;
					let organizationName: string | null = null;
					const accountName = getValue(row, mapping.account);

					if (accountName && createOrganizations) {
						// Check cache first
						if (orgCache.has(accountName)) {
							organizationId = orgCache.get(accountName)!;
							organizationName = accountName;
						} else {
							// Look up or create organization
							const { data: existingOrg } = await supabaseAdmin
								.from("organizations" as any)
								.select("id")
								.eq("project_id" as any, projectId)
								.ilike("name" as any, accountName)
								.limit(1)
								.single();

							if (existingOrg) {
								organizationId = (existingOrg as any).id;
								organizationName = accountName;
								orgCache.set(accountName, organizationId);
							} else {
								// Create new organization
								const { data: newOrg, error: orgError } = await supabaseAdmin
									.from("organizations" as any)
									.insert({
										project_id: projectId,
										name: accountName,
									})
									.select("id")
									.single();

								if (newOrg && !orgError) {
									organizationId = (newOrg as any).id;
									organizationName = accountName;
									orgCache.set(accountName, organizationId);
									organizationsCreated++;
									consola.debug(`[import-opportunities] Created organization: ${accountName}`);
								}
							}
						}
					}

					// Create opportunity
					const { data: opportunity, error: oppError } = await supabaseAdmin
						.from("opportunities")
						.insert({
							account_id: accountId,
							project_id: projectId,
							title,
							description,
							amount,
							currency,
							stage,
							close_date: closeDate,
							confidence,
							next_step: nextStep,
							source,
							crm_external_id: crmId,
							organization_id: organizationId,
							metadata: {},
						})
						.select("id")
						.single();

					if (oppError) {
						errors.push(`Row ${i + 1}: ${oppError.message}`);
						skipped++;
						continue;
					}

					if (opportunity) {
						results.push({
							opportunityId: opportunity.id,
							title,
							amount: amount || undefined,
							stage: stage || undefined,
							organizationId: organizationId || undefined,
							organizationName: organizationName || undefined,
							rowIndex: i,
						});

						// Add to existing set to prevent duplicates within same import
						if (crmId) {
							existingCrmIds.add(crmId);
						}
					}
				} catch (rowError) {
					errors.push(`Row ${i + 1}: ${rowError instanceof Error ? rowError.message : "Unknown error"}`);
					skipped++;
				}
			}

			const imported = results.length;
			consola.info(
				`[import-opportunities] Imported ${imported} opportunities, skipped ${skipped}, created ${organizationsCreated} organizations`
			);

			// Stream progress - complete
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "importOpportunitiesFromTable",
					status: "complete",
					message: `Imported ${imported} opportunities${organizationsCreated > 0 ? `, created ${organizationsCreated} organizations` : ""}`,
					progress: 100,
				},
			});

			return {
				success: true,
				message: `Imported ${imported} opportunities${organizationsCreated > 0 ? `, created ${organizationsCreated} organizations` : ""}${skipped > 0 ? `, skipped ${skipped} rows` : ""}.`,
				imported,
				skipped,
				organizationsCreated,
				results: results.length > 0 ? results : undefined,
				errors: errors.length > 0 ? errors : undefined,
			};
		} catch (error) {
			consola.error("[import-opportunities] Error:", error);
			return {
				success: false,
				message: "Failed to import opportunities",
				imported: 0,
				skipped,
				organizationsCreated,
				errors: [error instanceof Error ? error.message : "Unknown error"],
			};
		}
	},
});
