import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import type { Database } from "~/database.types"
import { persistFacetObservations } from "~/lib/database/facets.server"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

// Type aliases for database tables - using explicit types to avoid schema drift issues
type ProjectAsset = Database["public"]["Tables"]["project_assets"]["Row"]
type Person = Database["public"]["Tables"]["people"]["Row"]
type Organization = Database["public"]["Tables"]["organizations"]["Row"]

/**
 * Facet observation type for imported data
 * Matches the structure expected by persistFacetObservations
 */
interface FacetObservation {
	kind_slug: string
	value: string
	source: string
	confidence: number
}

/**
 * Column mapping schema - maps spreadsheet columns to people/organization fields
 * Extended to support social profiles, addresses, and flexible company context
 */
const columnMappingSchema = z.object({
	// Name fields
	name: z.string().nullish().describe("Column name containing full name"),
	firstname: z.string().nullish().describe("Column name containing first name"),
	lastname: z.string().nullish().describe("Column name containing last name"),

	// Primary contact info
	email: z.string().nullish().describe("Column name containing email address"),
	phone: z.string().nullish().describe("Column name containing phone number"),
	website: z.string().nullish().describe("Column name containing website URL"),
	address: z.string().nullish().describe("Column name containing full address"),

	// Social profiles - stored in contact_info JSONB
	linkedin: z.string().nullish().describe("Column name containing LinkedIn URL"),
	twitter: z.string().nullish().describe("Column name containing Twitter/X URL or handle"),
	instagram: z.string().nullish().describe("Column name containing Instagram URL or handle"),
	tiktok: z.string().nullish().describe("Column name containing TikTok URL or handle"),

	// Professional info
	title: z.string().nullish().describe("Column name containing job title"),
	company: z.string().nullish().describe("Column name containing company/organization name"),
	role: z.string().nullish().describe("Column name containing role"),
	industry: z.string().nullish().describe("Column name containing industry"),
	location: z.string().nullish().describe("Column name containing location (city/region)"),

	// Company context - stored on organizations table
	company_stage: z.string().nullish().describe("Column name containing company stage (Startup, Growth, etc.)"),
	company_size: z.string().nullish().describe("Column name containing company size"),

	// Company metrics - stored on organizations table
	company_url: z.string().nullish().describe("Column name containing company website URL"),
	annual_revenue: z.string().nullish().describe("Column name containing company annual revenue"),
	market_cap: z.string().nullish().describe("Column name containing company market capitalization"),
	funding_stage: z.string().nullish().describe("Column name containing funding stage (Seed, Series A, etc.)"),
	total_funding: z.string().nullish().describe("Column name containing total funding raised"),

	// Segmentation
	segment: z.string().nullish().describe("Column name containing customer segment"),
	lifecycle_stage: z.string().nullish().describe("Column name containing lifecycle stage"),
})

type ColumnMapping = z.infer<typeof columnMappingSchema>

interface TableRow {
	[key: string]: unknown
}

interface ImportResult {
	personId: string
	name: string
	organizationId?: string
	organizationName?: string
	rowIndex: number
}

/**
 * Normalize column name for matching (lowercase, trim, remove special chars)
 */
function normalizeColumnName(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]/g, "")
}

/**
 * Auto-detect column mappings from headers
 */
function autoDetectMappings(headers: string[]): ColumnMapping {
	const mapping: ColumnMapping = {}
	const normalizedHeaders = headers.map((h) => ({
		original: h,
		normalized: normalizeColumnName(h),
	}))

	const patterns: Record<keyof ColumnMapping, string[]> = {
		// Name fields
		name: ["name", "fullname", "contactname", "personname"],
		firstname: ["firstname", "first", "fname", "givenname"],
		lastname: ["lastname", "last", "lname", "surname", "familyname"],
		// Primary contact
		email: ["email", "emailaddress", "mail", "emailid"],
		phone: ["phone", "phonenumber", "mobile", "cell", "telephone", "tel"],
		website: ["website", "url", "personalsite", "homepage", "web"],
		address: ["address", "fulladdress", "streetaddress", "mailingaddress"],
		// Social profiles
		linkedin: ["linkedin", "linkedinurl", "linkedinprofile"],
		twitter: ["twitter", "twitterurl", "twitterhandle", "xhandle", "xurl"],
		instagram: ["instagram", "instagramurl", "ig", "ighandle"],
		tiktok: ["tiktok", "tiktokurl", "tiktokhandle"],
		// Professional info
		title: ["title", "jobtitle", "position", "designation"],
		company: ["company", "organization", "org", "employer", "companyname", "account", "accountname"],
		role: ["role", "function", "jobfunction"],
		industry: ["industry", "sector", "vertical"],
		location: ["location", "city", "region", "country"],
		// Company context
		company_stage: ["companystage", "stage", "fundingstage", "companytype"],
		company_size: ["companysize", "employeecount", "headcount", "teamsize", "employees"],
		// Company metrics
		company_url: ["companyurl", "companywebsite", "domain", "companydomain", "companysite"],
		annual_revenue: ["annualrevenue", "revenue", "arr", "yearlyrevenue", "sales"],
		market_cap: ["marketcap", "marketcapitalization", "valuation", "companyvaluation"],
		funding_stage: ["fundingstage", "fundingtype", "round", "investmentround", "fundinground"],
		total_funding: ["totalfunding", "fundingraised", "capitalraised", "totalinvestment"],
		// Segmentation
		segment: ["segment", "customersegment", "type", "category"],
		lifecycle_stage: ["lifecyclestage", "leadstatus", "customerstatus"],
	}

	for (const [field, fieldPatterns] of Object.entries(patterns)) {
		for (const header of normalizedHeaders) {
			if (fieldPatterns.some((p) => header.normalized.includes(p))) {
				mapping[field as keyof ColumnMapping] = header.original
				break
			}
		}
	}

	return mapping
}

/**
 * Extract value from row using column mapping
 */
function getValue(row: TableRow, columnName: string | undefined): string | null {
	if (!columnName) return null
	const value = row[columnName]
	if (value === null || value === undefined || value === "") return null
	return String(value).trim()
}

/**
 * Parse a numeric value from various formats (currency, abbreviations, etc.)
 * Handles: "$1,000,000", "1.5M", "1.5B", "1500000", etc.
 */
function parseNumericValue(value: string | null): number | null {
	if (!value) return null

	// Remove currency symbols, spaces, and commas
	const cleaned = value
		.replace(/[$€£¥,\s]/g, "")
		.trim()
		.toUpperCase()

	// Handle abbreviations (K, M, B, T)
	const multipliers: Record<string, number> = {
		K: 1_000,
		M: 1_000_000,
		B: 1_000_000_000,
		T: 1_000_000_000_000,
	}

	for (const [suffix, multiplier] of Object.entries(multipliers)) {
		if (cleaned.endsWith(suffix)) {
			const numPart = cleaned.slice(0, -1)
			const parsed = Number.parseFloat(numPart)
			if (!isNaN(parsed)) {
				return parsed * multiplier
			}
		}
	}

	// Try parsing as a plain number
	const parsed = Number.parseFloat(cleaned)
	return isNaN(parsed) ? null : parsed
}

/**
 * Parse a name into first and last name
 */
function parseName(fullName: string): { firstname: string; lastname: string } {
	const parts = fullName.trim().split(/\s+/)
	if (parts.length === 1) {
		return { firstname: parts[0], lastname: "" }
	}
	return {
		firstname: parts[0],
		lastname: parts.slice(1).join(" "),
	}
}

/**
 * Detect if a value looks like a full name (contains space, multiple words)
 * This is a safety check to catch LLM mapping errors
 */
function looksLikeFullName(value: string | null): boolean {
	if (!value) return false
	const trimmed = value.trim()
	// Contains space and has multiple words = likely full name
	return trimmed.includes(" ") && trimmed.split(/\s+/).length >= 2
}

/**
 * Validate and fix name fields - catches LLM mapping errors
 * Returns corrected firstname/lastname
 */
function validateAndFixNames(
	firstname: string | null,
	lastname: string | null,
	fullName: string | null
): { firstname: string; lastname: string } {
	// Case 1: We have a fullName field - parse it
	if (fullName && !firstname) {
		return parseName(fullName)
	}

	// Case 2: firstname looks like a full name (LLM error) - parse it
	if (firstname && looksLikeFullName(firstname)) {
		consola.warn(`[import-people] Detected full name in firstname field: "${firstname}" - auto-parsing`)
		return parseName(firstname)
	}

	// Case 3: firstname and lastname are identical (LLM error) - parse firstname
	if (firstname && lastname && firstname === lastname) {
		consola.warn(`[import-people] Detected identical firstname/lastname: "${firstname}" - auto-parsing`)
		return parseName(firstname)
	}

	// Case 4: Normal case - use as-is
	return {
		firstname: firstname || "",
		lastname: lastname || "",
	}
}

export const importPeopleFromTableTool = createTool({
	id: "importPeopleFromTable",
	description: `Import people and organizations from a parsed spreadsheet table into the CRM.

⚠️ CRITICAL - Column Mapping Rules (READ CAREFULLY):
- columnMapping is 100% OPTIONAL - the tool auto-detects columns from headers
- DO NOT pass columnMapping at all unless you need to override auto-detection
- NEVER set fields to null - this is WRONG and will cause problems
- If a field is not in the spreadsheet, DO NOT include it in columnMapping
- Unmapped/omitted fields are SKIPPED - they do NOT overwrite existing data
- The tool handles missing fields gracefully - you don't need to specify them

CORRECT usage: { assetId: "xxx" } // Let auto-detection work
CORRECT usage: { assetId: "xxx", columnMapping: { name: "Full Name", email: "Email" } } // Only map fields that exist
WRONG usage: { columnMapping: { name: "Name", email: null, phone: null, ... } } // NEVER do this!

Use this tool when:
- User has pasted contact/customer data and wants to import it
- parseSpreadsheet returned looksLikeContacts: true
- User explicitly asks to "import contacts", "add these people", "create CRM records"

Handle duplicates:
- Default mode="create" skips rows where email OR name+company already exists
- Use mode="upsert" to UPDATE existing people with new data from spreadsheet
- In upsert mode: existing fields are PRESERVED unless the spreadsheet has a value for them

The tool will:
1. Auto-detect column mappings if not provided (RECOMMENDED - just omit columnMapping entirely)
2. Create organization records for unique companies
3. Create or update people records linked to organizations
4. In upsert mode: match by email or name+company, update ONLY provided fields, preserve all other data
5. Return summary with created/updated/skipped counts`,
	inputSchema: z.object({
		assetId: z.string().uuid().describe("ID of the project_asset containing the table data"),
		columnMapping: columnMappingSchema
			.nullish()
			.describe(
				"OPTIONAL - Leave undefined to use auto-detection (RECOMMENDED). If provided, only include fields that exist in your spreadsheet. Do NOT map fields to null - simply omit them. Unmapped fields are skipped, not overwritten."
			),
		mode: z
			.enum(["create", "upsert"])
			.nullish()
			.default("create")
			.describe(
				"'create' = skip existing people, 'upsert' = match by email and UPDATE only fields that have values in spreadsheet (preserves existing data for unmapped/empty fields)"
			),
		skipDuplicates: z
			.boolean()
			.nullish()
			.default(true)
			.describe("Skip rows where email already exists (only applies in 'create' mode)"),
		createOrganizations: z
			.boolean()
			.nullish()
			.default(true)
			.describe("Create organization records from company column"),
		facetColumns: z
			.array(
				z.object({
					column: z.string().describe("Column name in the spreadsheet"),
					facetKind: z.string().describe("Facet kind slug (e.g., 'event', 'survey_response', 'persona')"),
				})
			)
			.nullish()
			.describe("Additional columns to import as facets (beyond the standard segment/role/industry/location)"),
		suggestedFacets: z
			.array(
				z.object({
					column: z.string().describe("Column name from spreadsheet"),
					facetKind: z.string().describe("Suggested facet kind slug"),
					sampleValues: z.array(z.string()).nullish().describe("Example values"),
					reason: z.string().nullish().describe("Why this should be a facet"),
				})
			)
			.nullish()
			.describe("LLM-suggested facets from parseSpreadsheet - will be auto-imported as facets for each person"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		imported: z.object({
			people: z.number().describe("Number of people records created"),
			updated: z.number().describe("Number of existing people records updated (upsert mode)"),
			organizations: z.number().describe("Number of organization records created"),
			facets: z.number().describe("Number of facet observations created"),
			surveyResponses: z.number().nullish().describe("Number of survey Q&A pairs created as evidence_facet records"),
			skipped: z.number().describe("Number of rows skipped (duplicates or invalid)"),
		}),
		details: z
			.array(
				z.object({
					personId: z.string(),
					name: z.string(),
					organizationId: z.string().optional(),
					organizationName: z.string().optional(),
					rowIndex: z.number(),
				})
			)
			.nullish()
			.describe("Details of imported records"),
		detectedMapping: z.record(z.string(), z.string()).nullish().describe("Auto-detected column mappings used"),
		skipReasons: z
			.array(
				z.object({
					rowIndex: z.number(),
					reason: z.string(),
					data: z.record(z.string(), z.unknown()).optional(),
				})
			)
			.nullish()
			.describe("First 10 skip reasons for debugging"),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		try {
			const writer = context?.writer
			const {
				assetId,
				columnMapping,
				mode = "create",
				skipDuplicates = true,
				createOrganizations = true,
				facetColumns = [],
				suggestedFacets = [],
			} = input

			// Merge suggestedFacets into facetColumns for unified processing
			// suggestedFacets comes from LLM analysis in parseSpreadsheet
			const allFacetColumns = [
				...facetColumns,
				...suggestedFacets.map((sf) => ({
					column: sf.column,
					facetKind: sf.facetKind,
				})),
			]

			// Separate survey_response columns from regular facet columns
			// Survey responses use evidence_facet (with question/answer) instead of person_facet
			const surveyColumns = allFacetColumns.filter((fc) => fc.facetKind === "survey_response")
			const regularFacetColumns = allFacetColumns.filter((fc) => fc.facetKind !== "survey_response")

			// Get accountId, projectId, and userId from runtime context
			const accountId = context?.requestContext?.get?.("account_id") as string | undefined
			const projectId = context?.requestContext?.get?.("project_id") as string | undefined
			const userId = context?.requestContext?.get?.("user_id") as string | undefined

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context",
					imported: {
						people: 0,
						updated: 0,
						organizations: 0,
						facets: 0,
						skipped: 0,
					},
					error: "Cannot import without account_id and project_id",
				}
			}

			const supabase = createSupabaseAdminClient()

			// Fetch the asset
			// Note: Using type assertion due to schema drift between local/remote databases
			const { data: asset, error: assetError } = (await (supabase as any)
				.from("project_assets")
				.select("*")
				.eq("id", assetId)
				.single()) as { data: ProjectAsset | null; error: Error | null }

			if (assetError || !asset) {
				return {
					success: false,
					message: "Asset not found",
					imported: {
						people: 0,
						updated: 0,
						organizations: 0,
						facets: 0,
						skipped: 0,
					},
					error: assetError?.message || "Asset not found",
				}
			}

			const tableData = asset.table_data as {
				headers: string[]
				rows: TableRow[]
			} | null
			if (!tableData || !tableData.headers || !tableData.rows) {
				return {
					success: false,
					message: "Asset does not contain valid table data",
					imported: {
						people: 0,
						updated: 0,
						organizations: 0,
						facets: 0,
						skipped: 0,
					},
					error: "No table_data found in asset",
				}
			}

			const { headers, rows } = tableData

			// Auto-detect or use provided mappings
			// DEFENSIVE: Strip out any null/undefined values from columnMapping
			// Some LLMs incorrectly pass null for unmapped fields despite instructions
			let cleanedColumnMapping: ColumnMapping | undefined
			if (columnMapping) {
				cleanedColumnMapping = Object.fromEntries(
					Object.entries(columnMapping).filter(([_, v]) => v != null && v !== "")
				) as ColumnMapping
				// If all values were null, treat as no mapping provided
				if (Object.keys(cleanedColumnMapping).length === 0) {
					cleanedColumnMapping = undefined
					consola.warn("[import-people] columnMapping had only null values - using auto-detection instead")
				}
			}
			const mapping = cleanedColumnMapping || autoDetectMappings(headers)

			// Check if we have enough info to import
			const hasNameField = mapping.name || (mapping.firstname && mapping.lastname) || mapping.firstname
			if (!hasNameField) {
				return {
					success: false,
					message: "Cannot detect name column. Please provide column mapping.",
					imported: {
						people: 0,
						updated: 0,
						organizations: 0,
						facets: 0,
						skipped: 0,
					},
					detectedMapping: mapping as Record<string, string>,
					error: "No name, firstname, or lastname column detected",
				}
			}

			// Get existing emails to check for duplicates
			const existingEmails = new Set<string>()
			if (skipDuplicates && mapping.email) {
				const { data: existingPeople } = (await (supabase as any)
					.from("people")
					.select("*")
					.eq("project_id", projectId)
					.not("primary_email", "is", null)) as { data: Person[] | null }

				if (existingPeople) {
					for (const p of existingPeople) {
						if (p.primary_email) {
							existingEmails.add(p.primary_email.toLowerCase())
						}
					}
				}
			}

			// Track organizations to avoid duplicates
			const orgCache = new Map<string, string>() // company name -> org id
			let orgsCreated = 0
			let peopleCreated = 0
			let peopleUpdated = 0
			let skipped = 0
			const importedDetails: ImportResult[] = []
			const skipReasons: {
				rowIndex: number
				reason: string
				data?: Record<string, unknown>
			}[] = []
			const facetObservationsByPerson: Array<{
				personId: string
				facets: FacetObservation[]
			}> = []

			consola.info(`[import-people] Starting import from asset ${assetId}`)
			// Log only non-undefined mappings for cleaner output
			const activeMappings = Object.fromEntries(Object.entries(mapping).filter(([_, v]) => v != null))
			consola.info("[import-people] Active mappings:", activeMappings)
			consola.info("[import-people] Headers:", headers)
			consola.info(`[import-people] Total rows: ${rows.length}`)

			// Stream progress - starting
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "importPeopleFromTable",
					status: "starting",
					message: `Importing ${rows.length} contacts...`,
					progress: 10,
				},
			})

			// Process each row
			for (let i = 0; i < rows.length; i++) {
				// Stream progress every 10 rows or on first/last row
				if (i === 0 || i === rows.length - 1 || i % 10 === 0) {
					const progress = Math.round(10 + (i / rows.length) * 70) // 10-80%
					await writer?.custom?.({
						type: "data-tool-progress",
						data: {
							tool: "importPeopleFromTable",
							status: "importing",
							message: `Processing row ${i + 1} of ${rows.length}...`,
							progress,
						},
					})
				}
				const row = rows[i]

				// Get name - with defensive validation to catch LLM mapping errors
				const rawFirstname = getValue(row, mapping.firstname)
				const rawLastname = getValue(row, mapping.lastname)
				const fullName = getValue(row, mapping.name)

				// Validate and fix names - catches cases where:
				// - Full name was incorrectly mapped to firstname/lastname
				// - firstname and lastname contain identical values
				// - firstname contains "John Smith" instead of just "John"
				const { firstname, lastname } = validateAndFixNames(rawFirstname, rawLastname, fullName)

				if (!firstname && !fullName) {
					const reason = `No name found (firstname col: ${mapping.firstname}, lastname col: ${mapping.lastname}, name col: ${mapping.name})`
					consola.warn(`[import-people] Row ${i}: Skipping - ${reason}`)
					consola.warn(`[import-people] Row ${i} data:`, JSON.stringify(row))
					skipReasons.push({
						rowIndex: i,
						reason,
						data: row as Record<string, unknown>,
					})
					skipped++
					continue
				}

				// Check for duplicate email or find existing person for upsert
				const email = getValue(row, mapping.email)
				let existingPersonId: string | undefined

				// First, check email duplicates (applies to both create and upsert modes)
				if (email) {
					if (mode === "create" && skipDuplicates && existingEmails.has(email.toLowerCase())) {
						// In create mode, skip email duplicates
						const reason = `Duplicate email: ${email}`
						consola.warn(`[import-people] Row ${i}: Skipping - ${reason}`)
						skipReasons.push({ rowIndex: i, reason })
						skipped++
						continue
					}

					// Find existing person by email for upsert
					const { data: existingPerson } = (await (supabase as any)
						.from("people")
						.select("id")
						.eq("project_id", projectId)
						.ilike("primary_email", email)
						.maybeSingle()) as { data: { id: string } | null }

					if (existingPerson) {
						existingPersonId = existingPerson.id
					}
				}

				// Fallback: check by name + company to prevent unique constraint violation
				// IMPORTANT: The unique constraint is at ACCOUNT level (account_id, name_hash, company)
				// not project level, so we must check across the entire account
				if (!existingPersonId && (firstname || fullName)) {
					const displayName = fullName || `${firstname || ""} ${lastname || ""}`.trim()
					const companyName = getValue(row, mapping.company)

					let existingByName: { id: string; project_id: string } | null = null

					if (companyName) {
						// Match by name + specific company
						const { data } = await (supabase as any)
							.from("people")
							.select("id, project_id")
							.eq("account_id", accountId)
							.ilike("name", displayName)
							.ilike("company", companyName)
							.maybeSingle()
						existingByName = data
					} else {
						// Match by name + empty/null company
						// The constraint uses COALESCE(lower(company), '') so we need to match both null and empty string
						// NOTE: Must create separate queries - Supabase query builder MUTATES the object!
						const { data: withNull } = await (supabase as any)
							.from("people")
							.select("id, project_id")
							.eq("account_id", accountId)
							.ilike("name", displayName)
							.is("company", null)
							.maybeSingle()

						if (withNull) {
							existingByName = withNull
						} else {
							const { data: withEmpty } = await (supabase as any)
								.from("people")
								.select("id, project_id")
								.eq("account_id", accountId)
								.ilike("name", displayName)
								.eq("company", "")
								.maybeSingle()
							existingByName = withEmpty
						}
					}

					if (existingByName) {
						existingPersonId = existingByName.id
						if (mode === "create") {
							// In create mode, skip existing people found by name+company
							const reason = `Duplicate name+company: ${displayName}${companyName ? ` @ ${companyName}` : ""}`
							consola.warn(`[import-people] Row ${i}: Skipping - ${reason}`)
							skipReasons.push({ rowIndex: i, reason })
							skipped++
							continue
						}
						consola.info(`[import-people] Row ${i}: Found existing person by name+company: ${displayName}`)
					}
				}

				// In create mode without an existing match, we'll proceed to insert
				// In upsert mode with an existing match, we'll update

				// Create or get organization
				let organizationId: string | undefined
				let organizationName: string | undefined
				const companyName = getValue(row, mapping.company)

				if (createOrganizations && companyName) {
					organizationName = companyName

					// Check cache first
					if (orgCache.has(companyName.toLowerCase())) {
						organizationId = orgCache.get(companyName.toLowerCase())
					} else {
						// Check if org exists in DB
						const { data: existingOrg } = (await (supabase as any)
							.from("organizations")
							.select("*")
							.eq("project_id", projectId)
							.ilike("name", companyName)
							.maybeSingle()) as { data: Organization | null }

						if (existingOrg) {
							organizationId = existingOrg.id
							orgCache.set(companyName.toLowerCase(), existingOrg.id)
						} else {
							// Create new organization with company context and metrics fields
							const { data: newOrg, error: orgError } = (await (supabase as any)
								.from("organizations")
								.insert({
									project_id: projectId,
									name: companyName,
									industry: getValue(row, mapping.industry),
									// Company context fields - these belong on organizations, not people
									company_type: getValue(row, mapping.company_stage),
									size_range: getValue(row, mapping.company_size),
									// Company metrics
									website_url: getValue(row, mapping.company_url),
									annual_revenue: parseNumericValue(getValue(row, mapping.annual_revenue)),
									market_cap: parseNumericValue(getValue(row, mapping.market_cap)),
									funding_stage: getValue(row, mapping.funding_stage),
									total_funding: parseNumericValue(getValue(row, mapping.total_funding)),
								})
								.select("*")
								.single()) as {
								data: Organization | null
								error: Error | null
							}

							if (orgError) {
								consola.error(`[import-people] Failed to create org ${companyName}:`, orgError)
							} else if (newOrg) {
								organizationId = newOrg.id
								orgCache.set(companyName.toLowerCase(), newOrg.id)
								orgsCreated++
							}
						}
					}
				}

				// Create or update person - note: 'name' is a generated column from firstname + lastname
				const displayName = fullName || `${firstname || ""} ${lastname || ""}`.trim()
				let personId: string

				// Build contact_info JSONB for flexible fields (social profiles, website, address)
				const contactInfo: Record<string, string> = {}
				const twitter = getValue(row, mapping.twitter)
				const instagram = getValue(row, mapping.instagram)
				const tiktok = getValue(row, mapping.tiktok)
				const website = getValue(row, mapping.website)
				const address = getValue(row, mapping.address)
				if (twitter) contactInfo.twitter = twitter
				if (instagram) contactInfo.instagram = instagram
				if (tiktok) contactInfo.tiktok = tiktok
				if (website) contactInfo.website = website
				if (address) contactInfo.address = address

				if (existingPersonId) {
					// Upsert mode: update existing person with only non-null fields from spreadsheet
					personId = existingPersonId

					// Build update object with only fields that have values in the spreadsheet
					// This ensures we don't overwrite existing data with null values
					const updateFields: Record<string, unknown> = {}

					// Only update name fields if they have values
					if (firstname) updateFields.firstname = firstname
					if (lastname) updateFields.lastname = lastname

					// Contact info - only update if column exists in mapping AND has a value
					if (mapping.phone) {
						const phone = getValue(row, mapping.phone)
						if (phone) updateFields.primary_phone = phone
					}
					if (mapping.linkedin) {
						const linkedin = getValue(row, mapping.linkedin)
						if (linkedin) updateFields.linkedin_url = linkedin
					}

					// Professional info
					if (mapping.title) {
						const title = getValue(row, mapping.title)
						if (title) updateFields.title = title
					}
					if (mapping.role) {
						const role = getValue(row, mapping.role)
						if (role) updateFields.role = role
					}
					if (mapping.industry) {
						const industry = getValue(row, mapping.industry)
						if (industry) updateFields.industry = industry
					}
					if (mapping.location) {
						const location = getValue(row, mapping.location)
						if (location) updateFields.location = location
					}

					// Segmentation
					if (mapping.segment) {
						const segment = getValue(row, mapping.segment)
						if (segment) updateFields.segment = segment
					}
					if (mapping.lifecycle_stage) {
						const lifecycleStage = getValue(row, mapping.lifecycle_stage)
						if (lifecycleStage) updateFields.lifecycle_stage = lifecycleStage
					}

					// Company name - update if present
					if (companyName) updateFields.company = companyName

					// Update organization link if we have one
					if (organizationId) updateFields.default_organization_id = organizationId

					// Merge contact_info with existing values (don't overwrite)
					if (Object.keys(contactInfo).length > 0) {
						// Fetch existing contact_info to merge
						const { data: existingPersonData } = await (supabase as any)
							.from("people")
							.select("contact_info")
							.eq("id", existingPersonId)
							.single()

						const existingContactInfo = (existingPersonData?.contact_info as Record<string, string>) || {}
						// Merge: new values take precedence, but don't remove existing ones
						updateFields.contact_info = {
							...existingContactInfo,
							...contactInfo,
						}
					}

					// Only update if we have fields to update
					if (Object.keys(updateFields).length > 0) {
						const { error: updateError } = await (supabase as any)
							.from("people")
							.update(updateFields)
							.eq("id", existingPersonId)

						if (updateError) {
							consola.warn(`[import-people] Row ${i}: Failed to update person ${displayName}:`, updateError)
						} else {
							consola.info(
								`[import-people] Row ${i}: Updated person ${displayName} with ${Object.keys(updateFields).length} fields`
							)
						}
					}

					peopleUpdated++
					consola.info(`[import-people] Row ${i}: Processed existing person ${displayName} (${existingPersonId})`)
				} else {
					// Create new person
					const { data: newPerson, error: personError } = (await (supabase as any)
						.from("people")
						.insert({
							account_id: accountId,
							project_id: projectId,
							firstname: firstname,
							lastname: lastname,
							primary_email: email,
							primary_phone: getValue(row, mapping.phone),
							linkedin_url: getValue(row, mapping.linkedin),
							title: getValue(row, mapping.title),
							company: companyName || "", // NOT NULL with default '' - must provide value
							role: getValue(row, mapping.role),
							industry: getValue(row, mapping.industry),
							location: getValue(row, mapping.location),
							segment: getValue(row, mapping.segment),
							lifecycle_stage: getValue(row, mapping.lifecycle_stage),
							default_organization_id: organizationId,
							// Store flexible contact info (social profiles, website, address)
							contact_info: Object.keys(contactInfo).length > 0 ? contactInfo : undefined,
						})
						.select("*")
						.single()) as {
						data: Person | null
						error: { message: string; code?: string } | null
					}

					if (personError || !newPerson) {
						const reason = `DB insert failed: ${personError?.message || "Unknown error"} (code: ${personError?.code || "unknown"})`
						consola.error(`[import-people] Row ${i}: Failed to create person ${displayName}:`, personError)
						skipReasons.push({
							rowIndex: i,
							reason,
							data: { displayName, firstname, lastname, email },
						})
						skipped++
						continue
					}

					personId = newPerson.id
					peopleCreated++

					// Link person to organization (only for new people)
					if (organizationId) {
						await (supabase as any).from("people_organizations").insert({
							person_id: personId,
							organization_id: organizationId,
							role: getValue(row, mapping.title) || getValue(row, mapping.role),
							is_primary: true,
						})
					}
				}

				if (personId) {
					if (email) {
						existingEmails.add(email.toLowerCase())
					}

					// Collect facet observations for this person
					const facetObservations: FacetObservation[] = []

					// Map spreadsheet fields to person facets
					// Note: company_stage and company_size are stored on organizations, not as person facets
					const facetFields: Array<{
						field: keyof ColumnMapping
						kindSlug: string
					}> = [
						{ field: "segment", kindSlug: "persona" },
						{ field: "lifecycle_stage", kindSlug: "persona" },
						{ field: "role", kindSlug: "role" },
						{ field: "industry", kindSlug: "industry" },
						{ field: "location", kindSlug: "location" },
					]

					for (const { field, kindSlug } of facetFields) {
						const value = getValue(row, mapping[field])
						if (value) {
							facetObservations.push({
								kind_slug: kindSlug,
								value: value,
								source: "document", // Imported from spreadsheet
								confidence: 0.9, // High confidence since it's explicit data
							})
						}
					}

					// Add custom facet columns including LLM-suggested facets (with defensive handling)
					for (const facetCol of allFacetColumns) {
						// Handle both object format and string format (in case LLM passes wrong format)
						let column: string | undefined
						let facetKind: string | undefined

						if (typeof facetCol === "object" && facetCol !== null) {
							column = facetCol.column
							facetKind = facetCol.facetKind
						} else if (typeof facetCol === "string") {
							// LLM passed a string instead of object - skip with warning
							consola.warn(`[import-people] Skipping malformed facetColumn (expected object, got string): ${facetCol}`)
							continue
						}

						if (!column || !facetKind) {
							consola.warn("[import-people] Skipping facetColumn with missing column or facetKind:", facetCol)
							continue
						}

						const value = getValue(row, column)
						if (value) {
							facetObservations.push({
								kind_slug: facetKind,
								value: value,
								source: "document",
								confidence: 0.9,
							})
						}
					}

					// Store facet observations for batch processing
					if (facetObservations.length > 0) {
						facetObservationsByPerson.push({
							personId: personId,
							facets: facetObservations,
						})
					}

					importedDetails.push({
						personId: personId,
						name: displayName,
						organizationId,
						organizationName,
						rowIndex: i,
					})
				}
			}

			// Stream progress - saving facets
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "importPeopleFromTable",
					status: "saving",
					message: "Saving facet observations...",
					progress: 85,
				},
			})

			// Persist facet observations for all imported people
			// First, deduplicate by personId and facet (kind_slug + value) to prevent upsert conflicts
			let facetsCreated = 0
			if (facetObservationsByPerson.length > 0 && projectId) {
				try {
					// Aggregate facets by personId, deduplicating identical observations
					const facetsByPersonId = new Map<string, Map<string, FacetObservation>>()
					for (const { personId, facets } of facetObservationsByPerson) {
						if (!facetsByPersonId.has(personId)) {
							facetsByPersonId.set(personId, new Map())
						}
						const personFacets = facetsByPersonId.get(personId)!
						for (const facet of facets) {
							// Use kind_slug + lowercase value as dedup key
							const key = `${facet.kind_slug}:${facet.value.toLowerCase()}`
							if (!personFacets.has(key)) {
								personFacets.set(key, facet)
							}
						}
					}

					// Convert back to array format
					const deduplicatedObservations = Array.from(facetsByPersonId.entries()).map(([personId, facetMap]) => ({
						personId,
						facets: Array.from(facetMap.values()),
						scales: [] as Array<{
							kind_slug: string
							value: number
							source: string
							confidence: number
						}>,
					}))

					await persistFacetObservations({
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						db: supabase as any,
						accountId,
						projectId,
						observations: deduplicatedObservations,
						evidenceIds: [], // No evidence IDs for imported data
					})
					facetsCreated = deduplicatedObservations.reduce((sum, o) => sum + o.facets.length, 0)
					consola.info(
						`[import-people] Created ${facetsCreated} facet observations for ${deduplicatedObservations.length} people`
					)
				} catch (facetError) {
					consola.warn("[import-people] Failed to persist facet observations:", facetError)
				}
			}

			// Process survey_response columns as evidence_facet records
			// This creates interview + evidence + evidence_facet for Q&A data
			let surveyResponsesCreated = 0
			if (surveyColumns.length > 0 && importedDetails.length > 0 && projectId) {
				try {
					consola.info(
						`[import-people] Processing ${surveyColumns.length} survey columns for ${importedDetails.length} people`
					)

					// Create interview record for the survey import
					const assetTitle = (asset as { title?: string }).title || "Imported Survey"
					const { data: interview, error: interviewError } = await (supabase as any)
						.from("interviews")
						.insert({
							account_id: accountId,
							project_id: projectId,
							title: `Survey: ${assetTitle}`,
							source_type: "survey_response",
							interview_type: "survey",
							status: "ready", // Valid enum values: draft,scheduled,uploading,uploaded,transcribing,transcribed,processing,ready,tagged,archived,error
							created_by: userId || null, // Track who imported this survey
							processing_metadata: {
								source_asset_id: assetId,
								import_date: new Date().toISOString(),
								survey_columns: [...new Set(surveyColumns.map((sc) => sc.column))], // Deduplicate
							},
						})
						.select("id")
						.single()

					if (interviewError || !interview) {
						consola.error("[import-people] Failed to create survey interview:", interviewError)
					} else {
						const interviewId = interview.id
						consola.info(`[import-people] Created survey interview: ${interviewId}`)

						// Get or create facet_account for each survey question
						// The question becomes the facet_account label, the answer goes in evidence_facet.quote
						const questionToFacetAccountId = new Map<string, number>()

						// Get the survey_response kind_id
						const { data: surveyKind } = await (supabase as any)
							.from("facet_kind_global")
							.select("id")
							.eq("slug", "survey_response")
							.single()

						const surveyKindId = surveyKind?.id
						if (!surveyKindId) {
							consola.error("[import-people] survey_response facet kind not found")
						} else {
							// Create facet_account entries for each unique question (column header)
							for (const surveyCol of surveyColumns) {
								const question = surveyCol.column
								const slug = question
									.toLowerCase()
									.replace(/[^a-z0-9]+/g, "_")
									.slice(0, 50)

								// Check if facet_account exists for this question
								const { data: existingFacet } = await (supabase as any)
									.from("facet_account")
									.select("id")
									.eq("account_id", accountId)
									.eq("kind_id", surveyKindId)
									.eq("slug", slug)
									.maybeSingle()

								if (existingFacet) {
									questionToFacetAccountId.set(question, existingFacet.id)
								} else {
									const { data: newFacet, error: facetError } = await (supabase as any)
										.from("facet_account")
										.insert({
											account_id: accountId,
											kind_id: surveyKindId,
											slug: slug,
											label: question,
											is_active: true,
										})
										.select("id")
										.single()

									if (facetError) {
										consola.error(
											`[import-people] Failed to create facet_account for question "${question}":`,
											facetError
										)
									} else if (newFacet) {
										questionToFacetAccountId.set(question, newFacet.id)
									}
								}
							}

							// Process each imported person's survey responses
							const evidenceRows: Array<{
								account_id: string
								project_id: string
								interview_id: string
								verbatim: string
								source_type: string
								method: string
								modality: string
							}> = []

							// Track which person each evidence row belongs to (by index)
							const evidencePersonIds: string[] = []

							const personRowDataMap = new Map<string, { rowIndex: number; name: string }>()

							for (const detail of importedDetails) {
								const row = rows[detail.rowIndex]
								if (!row) continue

								// Check if this person has any survey responses
								const responses: Array<{ question: string; answer: string }> = []
								for (const surveyCol of surveyColumns) {
									const answer = getValue(row, surveyCol.column)
									if (answer) {
										responses.push({ question: surveyCol.column, answer })
									}
								}

								if (responses.length > 0) {
									// Create evidence record for this person's survey responses
									const verbatim = responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")

									evidenceRows.push({
										account_id: accountId,
										project_id: projectId,
										interview_id: interviewId,
										verbatim: verbatim,
										source_type: "primary",
										method: "survey",
										modality: "qual",
									})
									evidencePersonIds.push(detail.personId) // Track person for evidence_people link

									personRowDataMap.set(detail.personId, {
										rowIndex: detail.rowIndex,
										name: detail.name,
									})
								}
							}

							if (evidenceRows.length > 0) {
								// Insert all evidence records
								const { data: insertedEvidence, error: evidenceError } = await (supabase as any)
									.from("evidence")
									.insert(evidenceRows)
									.select("id")

								if (evidenceError) {
									consola.error("[import-people] Failed to insert evidence:", evidenceError)
								} else if (insertedEvidence && insertedEvidence.length > 0) {
									const evidenceIds = insertedEvidence.map((e: { id: string }) => e.id)

									// Create evidence_people links (proper junction table for evidence<->person relationship)
									const evidencePeopleRows = evidenceIds.map((evidenceId, idx) => ({
										evidence_id: evidenceId,
										person_id: evidencePersonIds[idx],
										account_id: accountId,
										project_id: projectId,
										role: "respondent",
									}))

									if (evidencePeopleRows.length > 0) {
										const { error: epError } = await (supabase as any)
											.from("evidence_people")
											.upsert(evidencePeopleRows, {
												onConflict: "evidence_id,person_id,account_id",
											})

										if (epError) {
											consola.warn("[import-people] Failed to link evidence to people:", epError)
										} else {
											consola.info(`[import-people] Created ${evidencePeopleRows.length} evidence_people links`)
										}
									}

									// Create evidence_facet records for each Q&A pair
									// person_id links directly to the person who answered (simpler than going through evidence_people)
									const evidenceFacetRows: Array<{
										evidence_id: string
										account_id: string
										project_id: string
										person_id: string // Direct link to person who answered
										kind_slug: string
										facet_account_id: number
										label: string
										quote: string
										source: string
										confidence: number
									}> = []

									// Create interview_people links
									const interviewPeopleRows: Array<{
										interview_id: string
										person_id: string
										project_id: string
										role: string
									}> = []

									let evidenceIndex = 0
									for (const detail of importedDetails) {
										const personData = personRowDataMap.get(detail.personId)
										if (!personData) continue

										const row = rows[personData.rowIndex]
										if (!row) continue

										const evidenceId = evidenceIds[evidenceIndex]
										if (!evidenceId) continue

										// Create interview_people link
										interviewPeopleRows.push({
											interview_id: interviewId,
											person_id: detail.personId,
											project_id: projectId,
											role: "respondent",
										})

										// Create evidence_facet for each Q&A
										for (const surveyCol of surveyColumns) {
											const answer = getValue(row, surveyCol.column)
											if (answer) {
												const facetAccountId = questionToFacetAccountId.get(surveyCol.column)
												if (facetAccountId) {
													evidenceFacetRows.push({
														evidence_id: evidenceId,
														account_id: accountId,
														project_id: projectId,
														person_id: detail.personId, // Direct link to person who answered
														kind_slug: "survey_response",
														facet_account_id: facetAccountId,
														label: surveyCol.column, // Question
														quote: answer, // Answer
														source: "survey",
														confidence: 0.95,
													})
													surveyResponsesCreated++
												}
											}
										}

										evidenceIndex++
									}

									// Insert interview_people links
									if (interviewPeopleRows.length > 0) {
										const { error: ipError } = await (supabase as any)
											.from("interview_people")
											.upsert(interviewPeopleRows, {
												onConflict: "interview_id,person_id",
											})

										if (ipError) {
											consola.warn("[import-people] Failed to link interview to people:", ipError)
										}
									}

									// Insert evidence_facet records
									if (evidenceFacetRows.length > 0) {
										const { error: efError } = await (supabase as any).from("evidence_facet").insert(evidenceFacetRows)

										if (efError) {
											consola.error("[import-people] Failed to insert evidence_facet:", efError)
										} else {
											consola.info(
												`[import-people] Created ${evidenceFacetRows.length} survey response evidence_facet records`
											)
										}
									}
								}
							}
						}
					}
				} catch (surveyError) {
					consola.error("[import-people] Failed to process survey responses:", surveyError)
				}
			}

			// Stream progress - complete
			await writer?.custom?.({
				type: "data-tool-progress",
				data: {
					tool: "importPeopleFromTable",
					status: "complete",
					message: "Import complete!",
					progress: 100,
				},
			})

			const assetTitle = (asset as { title?: string }).title || "spreadsheet"
			const message = `Imported ${peopleCreated} people${peopleUpdated > 0 ? `, updated ${peopleUpdated}` : ""} and ${orgsCreated} organizations from "${assetTitle}".${facetsCreated > 0 ? ` Created ${facetsCreated} facets.` : ""}${surveyResponsesCreated > 0 ? ` Created ${surveyResponsesCreated} survey responses.` : ""} ${skipped > 0 ? `Skipped ${skipped} rows.` : ""}`

			consola.info(`[import-people] ${message}`)
			if (skipReasons.length > 0) {
				consola.warn("[import-people] Skip reasons:", skipReasons.slice(0, 5))
			}

			return {
				success: true,
				message,
				imported: {
					people: peopleCreated,
					updated: peopleUpdated,
					organizations: orgsCreated,
					facets: facetsCreated,
					surveyResponses: surveyResponsesCreated > 0 ? surveyResponsesCreated : undefined,
					skipped,
				},
				details: importedDetails.slice(0, 20), // Limit details to first 20
				detectedMapping: mapping as Record<string, string>,
				skipReasons: skipReasons.slice(0, 10), // Include first 10 skip reasons for debugging
			}
		} catch (error) {
			consola.error("[import-people] Error:", error)
			return {
				success: false,
				message: "Failed to import people",
				imported: {
					people: 0,
					updated: 0,
					organizations: 0,
					facets: 0,
					skipped: 0,
				},
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
