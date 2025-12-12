import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"

/**
 * Column mapping schema - maps spreadsheet columns to people/organization fields
 */
const columnMappingSchema = z.object({
	// Required
	name: z.string().optional().describe("Column name containing full name"),
	firstname: z.string().optional().describe("Column name containing first name"),
	lastname: z.string().optional().describe("Column name containing last name"),

	// Contact info
	email: z.string().optional().describe("Column name containing email address"),
	phone: z.string().optional().describe("Column name containing phone number"),
	linkedin: z.string().optional().describe("Column name containing LinkedIn URL"),

	// Professional info
	title: z.string().optional().describe("Column name containing job title"),
	company: z.string().optional().describe("Column name containing company/organization name"),
	role: z.string().optional().describe("Column name containing role"),
	industry: z.string().optional().describe("Column name containing industry"),
	location: z.string().optional().describe("Column name containing location"),

	// Segmentation
	segment: z.string().optional().describe("Column name containing customer segment"),
	lifecycle_stage: z.string().optional().describe("Column name containing lifecycle stage"),
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
	return name.toLowerCase().trim().replace(/[^a-z0-9]/g, "")
}

/**
 * Auto-detect column mappings from headers
 */
function autoDetectMappings(headers: string[]): ColumnMapping {
	const mapping: ColumnMapping = {}
	const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeColumnName(h) }))

	const patterns: Record<keyof ColumnMapping, string[]> = {
		name: ["name", "fullname", "contactname", "personname"],
		firstname: ["firstname", "first", "fname", "givenname"],
		lastname: ["lastname", "last", "lname", "surname", "familyname"],
		email: ["email", "emailaddress", "mail", "emailid"],
		phone: ["phone", "phonenumber", "mobile", "cell", "telephone", "tel"],
		linkedin: ["linkedin", "linkedinurl", "linkedinprofile"],
		title: ["title", "jobtitle", "position", "designation"],
		company: ["company", "organization", "org", "employer", "companyname", "account", "accountname"],
		role: ["role", "function", "jobfunction"],
		industry: ["industry", "sector", "vertical"],
		location: ["location", "city", "address", "region", "country"],
		segment: ["segment", "customersegment", "type", "category"],
		lifecycle_stage: ["stage", "lifecyclestage", "status", "leadstatus"],
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

export const importPeopleFromTableTool = createTool({
	id: "importPeopleFromTable",
	description: `Import people and organizations from a parsed spreadsheet table into the CRM.

Use this tool when:
- User has pasted contact/customer data and wants to import it
- parseSpreadsheet returned looksLikeContacts: true
- User explicitly asks to "import contacts", "add these people", "create CRM records"

The tool will:
1. Auto-detect column mappings if not provided
2. Create organization records for unique companies
3. Create people records linked to organizations
4. Skip duplicates based on email
5. Return summary of imported records`,
	inputSchema: z.object({
		assetId: z.string().uuid().describe("ID of the project_asset containing the table data"),
		columnMapping: columnMappingSchema.optional().describe("Optional explicit column mappings. Auto-detected if not provided."),
		skipDuplicates: z.boolean().optional().default(true).describe("Skip rows where email already exists in the project"),
		createOrganizations: z.boolean().optional().default(true).describe("Create organization records from company column"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		imported: z.object({
			people: z.number().describe("Number of people records created"),
			organizations: z.number().describe("Number of organization records created"),
			skipped: z.number().describe("Number of rows skipped (duplicates or invalid)"),
		}),
		details: z.array(z.object({
			personId: z.string(),
			name: z.string(),
			organizationId: z.string().optional(),
			organizationName: z.string().optional(),
			rowIndex: z.number(),
		})).optional().describe("Details of imported records"),
		detectedMapping: z.record(z.string(), z.string()).optional().describe("Auto-detected column mappings used"),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		try {
			const { assetId, columnMapping, skipDuplicates = true, createOrganizations = true } = context

			// Get accountId and projectId from runtime context
			const accountId = runtimeContext?.get?.("account_id") as string | undefined
			const projectId = runtimeContext?.get?.("project_id") as string | undefined

			if (!accountId || !projectId) {
				return {
					success: false,
					message: "Missing account or project context",
					imported: { people: 0, organizations: 0, skipped: 0 },
					error: "Cannot import without account_id and project_id",
				}
			}

			const supabase = createSupabaseAdminClient()

			// Fetch the asset
			const { data: asset, error: assetError } = await supabase
				.from("project_assets")
				.select("id, title, table_data, row_count, column_count")
				.eq("id", assetId)
				.single()

			if (assetError || !asset) {
				return {
					success: false,
					message: "Asset not found",
					imported: { people: 0, organizations: 0, skipped: 0 },
					error: assetError?.message || "Asset not found",
				}
			}

			const tableData = asset.table_data as { headers: string[]; rows: TableRow[] } | null
			if (!tableData || !tableData.headers || !tableData.rows) {
				return {
					success: false,
					message: "Asset does not contain valid table data",
					imported: { people: 0, organizations: 0, skipped: 0 },
					error: "No table_data found in asset",
				}
			}

			const { headers, rows } = tableData

			// Auto-detect or use provided mappings
			const mapping = columnMapping || autoDetectMappings(headers)

			// Check if we have enough info to import
			const hasNameField = mapping.name || (mapping.firstname && mapping.lastname) || mapping.firstname
			if (!hasNameField) {
				return {
					success: false,
					message: "Cannot detect name column. Please provide column mapping.",
					imported: { people: 0, organizations: 0, skipped: 0 },
					detectedMapping: mapping as Record<string, string>,
					error: "No name, firstname, or lastname column detected",
				}
			}

			// Get existing emails to check for duplicates
			const existingEmails = new Set<string>()
			if (skipDuplicates && mapping.email) {
				const { data: existingPeople } = await supabase
					.from("people")
					.select("primary_email")
					.eq("project_id", projectId)
					.not("primary_email", "is", null)

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
			let skipped = 0
			const importedDetails: ImportResult[] = []

			// Process each row
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i]

				// Get name
				let firstname = getValue(row, mapping.firstname)
				let lastname = getValue(row, mapping.lastname)
				const fullName = getValue(row, mapping.name)

				if (fullName && !firstname) {
					const parsed = parseName(fullName)
					firstname = parsed.firstname
					lastname = parsed.lastname
				}

				if (!firstname && !fullName) {
					consola.debug(`[import-people] Row ${i}: Skipping - no name`)
					skipped++
					continue
				}

				// Check for duplicate email
				const email = getValue(row, mapping.email)
				if (skipDuplicates && email && existingEmails.has(email.toLowerCase())) {
					consola.debug(`[import-people] Row ${i}: Skipping duplicate email ${email}`)
					skipped++
					continue
				}

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
						const { data: existingOrg } = await supabase
							.from("organizations")
							.select("id")
							.eq("project_id", projectId)
							.ilike("name", companyName)
							.maybeSingle()

						if (existingOrg) {
							organizationId = existingOrg.id
							orgCache.set(companyName.toLowerCase(), existingOrg.id)
						} else {
							// Create new organization
							const { data: newOrg, error: orgError } = await supabase
								.from("organizations")
								.insert({
									project_id: projectId,
									name: companyName,
									industry: getValue(row, mapping.industry),
								})
								.select("id")
								.single()

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

				// Create person - note: 'name' is a generated column from firstname + lastname
				const displayName = fullName || `${firstname || ""} ${lastname || ""}`.trim()
				const { data: newPerson, error: personError } = await supabase
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
						company: companyName,
						role: getValue(row, mapping.role),
						industry: getValue(row, mapping.industry),
						location: getValue(row, mapping.location),
						segment: getValue(row, mapping.segment),
						lifecycle_stage: getValue(row, mapping.lifecycle_stage),
						default_organization_id: organizationId,
					})
					.select("id")
					.single()

				if (personError) {
					consola.error(`[import-people] Failed to create person ${displayName}:`, personError)
					skipped++
					continue
				}

				// Link person to organization
				if (organizationId && newPerson) {
					await supabase.from("people_organizations").insert({
						person_id: newPerson.id,
						organization_id: organizationId,
						role: getValue(row, mapping.title) || getValue(row, mapping.role),
						is_primary: true,
					})
				}

				if (newPerson) {
					peopleCreated++
					if (email) {
						existingEmails.add(email.toLowerCase())
					}
					importedDetails.push({
						personId: newPerson.id,
						name: displayName,
						organizationId,
						organizationName,
						rowIndex: i,
					})
				}
			}

			const message = `Imported ${peopleCreated} people and ${orgsCreated} organizations from "${asset.title}". ${skipped > 0 ? `Skipped ${skipped} rows.` : ""}`

			consola.info(`[import-people] ${message}`)

			return {
				success: true,
				message,
				imported: {
					people: peopleCreated,
					organizations: orgsCreated,
					skipped,
				},
				details: importedDetails.slice(0, 20), // Limit details to first 20
				detectedMapping: mapping as Record<string, string>,
			}
		} catch (error) {
			consola.error("[import-people] Error:", error)
			return {
				success: false,
				message: "Failed to import people",
				imported: { people: 0, organizations: 0, skipped: 0 },
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
