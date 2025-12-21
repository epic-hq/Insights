import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { persistFacetObservations } from "~/lib/database/facets.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import type { Database } from "~/database.types";

// Type aliases for database tables - using explicit types to avoid schema drift issues
type ProjectAsset = Database["public"]["Tables"]["project_assets"]["Row"];
type Person = Database["public"]["Tables"]["people"]["Row"];
type Organization = Database["public"]["Tables"]["organizations"]["Row"];

/**
 * Facet observation type for imported data
 * Matches the structure expected by persistFacetObservations
 */
interface FacetObservation {
  kind_slug: string;
  value: string;
  source: string;
  confidence: number;
}

/**
 * Column mapping schema - maps spreadsheet columns to people/organization fields
 * Extended to support social profiles, addresses, and flexible company context
 */
const columnMappingSchema = z.object({
  // Name fields
  name: z.string().optional().describe("Column name containing full name"),
  firstname: z
    .string()
    .optional()
    .describe("Column name containing first name"),
  lastname: z.string().optional().describe("Column name containing last name"),

  // Primary contact info
  email: z.string().optional().describe("Column name containing email address"),
  phone: z.string().optional().describe("Column name containing phone number"),
  website: z.string().optional().describe("Column name containing website URL"),
  address: z
    .string()
    .optional()
    .describe("Column name containing full address"),

  // Social profiles - stored in contact_info JSONB
  linkedin: z
    .string()
    .optional()
    .describe("Column name containing LinkedIn URL"),
  twitter: z
    .string()
    .optional()
    .describe("Column name containing Twitter/X URL or handle"),
  instagram: z
    .string()
    .optional()
    .describe("Column name containing Instagram URL or handle"),
  tiktok: z
    .string()
    .optional()
    .describe("Column name containing TikTok URL or handle"),

  // Professional info
  title: z.string().optional().describe("Column name containing job title"),
  company: z
    .string()
    .optional()
    .describe("Column name containing company/organization name"),
  role: z.string().optional().describe("Column name containing role"),
  industry: z.string().optional().describe("Column name containing industry"),
  location: z
    .string()
    .optional()
    .describe("Column name containing location (city/region)"),

  // Company context - stored on organizations table
  company_stage: z
    .string()
    .optional()
    .describe("Column name containing company stage (Startup, Growth, etc.)"),
  company_size: z
    .string()
    .optional()
    .describe("Column name containing company size"),

  // Company metrics - stored on organizations table
  company_url: z
    .string()
    .optional()
    .describe("Column name containing company website URL"),
  annual_revenue: z
    .string()
    .optional()
    .describe("Column name containing company annual revenue"),
  market_cap: z
    .string()
    .optional()
    .describe("Column name containing company market capitalization"),
  funding_stage: z
    .string()
    .optional()
    .describe("Column name containing funding stage (Seed, Series A, etc.)"),
  total_funding: z
    .string()
    .optional()
    .describe("Column name containing total funding raised"),

  // Segmentation
  segment: z
    .string()
    .optional()
    .describe("Column name containing customer segment"),
  lifecycle_stage: z
    .string()
    .optional()
    .describe("Column name containing lifecycle stage"),
});

type ColumnMapping = z.infer<typeof columnMappingSchema>;

interface TableRow {
  [key: string]: unknown;
}

interface ImportResult {
  personId: string;
  name: string;
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
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeColumnName(h),
  }));

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
    company: [
      "company",
      "organization",
      "org",
      "employer",
      "companyname",
      "account",
      "accountname",
    ],
    role: ["role", "function", "jobfunction"],
    industry: ["industry", "sector", "vertical"],
    location: ["location", "city", "region", "country"],
    // Company context
    company_stage: ["companystage", "stage", "fundingstage", "companytype"],
    company_size: [
      "companysize",
      "employeecount",
      "headcount",
      "teamsize",
      "employees",
    ],
    // Company metrics
    company_url: [
      "companyurl",
      "companywebsite",
      "domain",
      "companydomain",
      "companysite",
    ],
    annual_revenue: [
      "annualrevenue",
      "revenue",
      "arr",
      "yearlyrevenue",
      "sales",
    ],
    market_cap: [
      "marketcap",
      "marketcapitalization",
      "valuation",
      "companyvaluation",
    ],
    funding_stage: [
      "fundingstage",
      "fundingtype",
      "round",
      "investmentround",
      "fundinground",
    ],
    total_funding: [
      "totalfunding",
      "fundingraised",
      "capitalraised",
      "totalinvestment",
    ],
    // Segmentation
    segment: ["segment", "customersegment", "type", "category"],
    lifecycle_stage: ["lifecyclestage", "leadstatus", "customerstatus"],
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
function getValue(
  row: TableRow,
  columnName: string | undefined,
): string | null {
  if (!columnName) return null;
  const value = row[columnName];
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

/**
 * Parse a numeric value from various formats (currency, abbreviations, etc.)
 * Handles: "$1,000,000", "1.5M", "1.5B", "1500000", etc.
 */
function parseNumericValue(value: string | null): number | null {
  if (!value) return null;

  // Remove currency symbols, spaces, and commas
  let cleaned = value
    .replace(/[$€£¥,\s]/g, "")
    .trim()
    .toUpperCase();

  // Handle abbreviations (K, M, B, T)
  const multipliers: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000,
    T: 1_000_000_000_000,
  };

  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.endsWith(suffix)) {
      const numPart = cleaned.slice(0, -1);
      const parsed = parseFloat(numPart);
      if (!isNaN(parsed)) {
        return parsed * multiplier;
      }
    }
  }

  // Try parsing as a plain number
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parse a name into first and last name
 */
function parseName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstname: parts[0], lastname: "" };
  }
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

/**
 * Detect if a value looks like a full name (contains space, multiple words)
 * This is a safety check to catch LLM mapping errors
 */
function looksLikeFullName(value: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  // Contains space and has multiple words = likely full name
  return trimmed.includes(" ") && trimmed.split(/\s+/).length >= 2;
}

/**
 * Validate and fix name fields - catches LLM mapping errors
 * Returns corrected firstname/lastname
 */
function validateAndFixNames(
  firstname: string | null,
  lastname: string | null,
  fullName: string | null,
): { firstname: string; lastname: string } {
  // Case 1: We have a fullName field - parse it
  if (fullName && !firstname) {
    return parseName(fullName);
  }

  // Case 2: firstname looks like a full name (LLM error) - parse it
  if (firstname && looksLikeFullName(firstname)) {
    consola.warn(
      `[import-people] Detected full name in firstname field: "${firstname}" - auto-parsing`,
    );
    return parseName(firstname);
  }

  // Case 3: firstname and lastname are identical (LLM error) - parse firstname
  if (firstname && lastname && firstname === lastname) {
    consola.warn(
      `[import-people] Detected identical firstname/lastname: "${firstname}" - auto-parsing`,
    );
    return parseName(firstname);
  }

  // Case 4: Normal case - use as-is
  return {
    firstname: firstname || "",
    lastname: lastname || "",
  };
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
    assetId: z
      .string()
      .uuid()
      .describe("ID of the project_asset containing the table data"),
    columnMapping: columnMappingSchema
      .optional()
      .describe(
        "Optional explicit column mappings. Auto-detected if not provided.",
      ),
    mode: z
      .enum(["create", "upsert"])
      .optional()
      .default("create")
      .describe(
        "'create' = skip existing people, 'upsert' = match by email and append facets to existing people",
      ),
    skipDuplicates: z
      .boolean()
      .optional()
      .default(true)
      .describe(
        "Skip rows where email already exists (only applies in 'create' mode)",
      ),
    createOrganizations: z
      .boolean()
      .optional()
      .default(true)
      .describe("Create organization records from company column"),
    facetColumns: z
      .array(
        z.object({
          column: z.string().describe("Column name in the spreadsheet"),
          facetKind: z
            .string()
            .describe(
              "Facet kind slug (e.g., 'event', 'survey_response', 'persona')",
            ),
        }),
      )
      .optional()
      .describe(
        "Additional columns to import as facets (beyond the standard segment/role/industry/location)",
      ),
    suggestedFacets: z
      .array(
        z.object({
          column: z.string().describe("Column name from spreadsheet"),
          facetKind: z.string().describe("Suggested facet kind slug"),
          sampleValues: z
            .array(z.string())
            .optional()
            .describe("Example values"),
          reason: z.string().optional().describe("Why this should be a facet"),
        }),
      )
      .optional()
      .describe(
        "LLM-suggested facets from parseSpreadsheet - will be auto-imported as facets for each person",
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    imported: z.object({
      people: z.number().describe("Number of people records created"),
      updated: z
        .number()
        .describe("Number of existing people records updated (upsert mode)"),
      organizations: z
        .number()
        .describe("Number of organization records created"),
      facets: z.number().describe("Number of facet observations created"),
      skipped: z
        .number()
        .describe("Number of rows skipped (duplicates or invalid)"),
    }),
    details: z
      .array(
        z.object({
          personId: z.string(),
          name: z.string(),
          organizationId: z.string().optional(),
          organizationName: z.string().optional(),
          rowIndex: z.number(),
        }),
      )
      .optional()
      .describe("Details of imported records"),
    detectedMapping: z
      .record(z.string(), z.string())
      .optional()
      .describe("Auto-detected column mappings used"),
    skipReasons: z
      .array(
        z.object({
          rowIndex: z.number(),
          reason: z.string(),
          data: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional()
      .describe("First 10 skip reasons for debugging"),
    error: z.string().optional(),
  }),
  execute: async (input, context?) => {
    try {
      const writer = context?.writer;
      const {
        assetId,
        columnMapping,
        mode = "create",
        skipDuplicates = true,
        createOrganizations = true,
        facetColumns = [],
        suggestedFacets = [],
      } = input;

      // Merge suggestedFacets into facetColumns for unified processing
      // suggestedFacets comes from LLM analysis in parseSpreadsheet
      const allFacetColumns = [
        ...facetColumns,
        ...suggestedFacets.map((sf) => ({
          column: sf.column,
          facetKind: sf.facetKind,
        })),
      ];

      // Get accountId and projectId from runtime context
      const accountId = context?.requestContext?.get?.("account_id") as
        | string
        | undefined;
      const projectId = context?.requestContext?.get?.("project_id") as
        | string
        | undefined;

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
        };
      }

      const supabase = createSupabaseAdminClient();

      // Fetch the asset
      // Note: Using type assertion due to schema drift between local/remote databases
      const { data: asset, error: assetError } = (await (supabase as any)
        .from("project_assets")
        .select("*")
        .eq("id", assetId)
        .single()) as { data: ProjectAsset | null; error: Error | null };

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
        };
      }

      const tableData = asset.table_data as {
        headers: string[];
        rows: TableRow[];
      } | null;
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
        };
      }

      const { headers, rows } = tableData;

      // Auto-detect or use provided mappings
      const mapping = columnMapping || autoDetectMappings(headers);

      // Check if we have enough info to import
      const hasNameField =
        mapping.name ||
        (mapping.firstname && mapping.lastname) ||
        mapping.firstname;
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
        };
      }

      // Get existing emails to check for duplicates
      const existingEmails = new Set<string>();
      if (skipDuplicates && mapping.email) {
        const { data: existingPeople } = (await (supabase as any)
          .from("people")
          .select("*")
          .eq("project_id", projectId)
          .not("primary_email", "is", null)) as { data: Person[] | null };

        if (existingPeople) {
          for (const p of existingPeople) {
            if (p.primary_email) {
              existingEmails.add(p.primary_email.toLowerCase());
            }
          }
        }
      }

      // Track organizations to avoid duplicates
      const orgCache = new Map<string, string>(); // company name -> org id
      let orgsCreated = 0;
      let peopleCreated = 0;
      let peopleUpdated = 0;
      let skipped = 0;
      const importedDetails: ImportResult[] = [];
      const skipReasons: {
        rowIndex: number;
        reason: string;
        data?: Record<string, unknown>;
      }[] = [];
      const facetObservationsByPerson: Array<{
        personId: string;
        facets: FacetObservation[];
      }> = [];

      consola.info(`[import-people] Starting import from asset ${assetId}`);
      consola.info("[import-people] Detected mapping:", mapping);
      consola.info("[import-people] Headers:", headers);
      consola.info(`[import-people] Total rows: ${rows.length}`);

      // Stream progress - starting
      await writer?.custom?.({
        type: "data-tool-progress",
        data: {
          tool: "importPeopleFromTable",
          status: "starting",
          message: `Importing ${rows.length} contacts...`,
          progress: 10,
        },
      });

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        // Stream progress every 10 rows or on first/last row
        if (i === 0 || i === rows.length - 1 || i % 10 === 0) {
          const progress = Math.round(10 + (i / rows.length) * 70); // 10-80%
          await writer?.custom?.({
            type: "data-tool-progress",
            data: {
              tool: "importPeopleFromTable",
              status: "importing",
              message: `Processing row ${i + 1} of ${rows.length}...`,
              progress,
            },
          });
        }
        const row = rows[i];

        // Get name - with defensive validation to catch LLM mapping errors
        const rawFirstname = getValue(row, mapping.firstname);
        const rawLastname = getValue(row, mapping.lastname);
        const fullName = getValue(row, mapping.name);

        // Validate and fix names - catches cases where:
        // - Full name was incorrectly mapped to firstname/lastname
        // - firstname and lastname contain identical values
        // - firstname contains "John Smith" instead of just "John"
        const { firstname, lastname } = validateAndFixNames(
          rawFirstname,
          rawLastname,
          fullName,
        );

        if (!firstname && !fullName) {
          const reason = `No name found (firstname col: ${mapping.firstname}, lastname col: ${mapping.lastname}, name col: ${mapping.name})`;
          consola.warn(`[import-people] Row ${i}: Skipping - ${reason}`);
          consola.warn(`[import-people] Row ${i} data:`, JSON.stringify(row));
          skipReasons.push({
            rowIndex: i,
            reason,
            data: row as Record<string, unknown>,
          });
          skipped++;
          continue;
        }

        // Check for duplicate email or find existing person for upsert
        const email = getValue(row, mapping.email);
        let existingPersonId: string | undefined;

        if (mode === "upsert" && email) {
          // In upsert mode, find existing person by email
          const { data: existingPerson } = (await (supabase as any)
            .from("people")
            .select("*")
            .eq("project_id", projectId)
            .ilike("primary_email", email)
            .maybeSingle()) as { data: Person | null };

          if (existingPerson) {
            existingPersonId = existingPerson.id;
          }
        } else if (
          skipDuplicates &&
          email &&
          existingEmails.has(email.toLowerCase())
        ) {
          // In create mode, skip duplicates
          const reason = `Duplicate email: ${email}`;
          consola.warn(`[import-people] Row ${i}: Skipping - ${reason}`);
          skipReasons.push({ rowIndex: i, reason });
          skipped++;
          continue;
        }

        // Create or get organization
        let organizationId: string | undefined;
        let organizationName: string | undefined;
        const companyName = getValue(row, mapping.company);

        if (createOrganizations && companyName) {
          organizationName = companyName;

          // Check cache first
          if (orgCache.has(companyName.toLowerCase())) {
            organizationId = orgCache.get(companyName.toLowerCase());
          } else {
            // Check if org exists in DB
            const { data: existingOrg } = (await (supabase as any)
              .from("organizations")
              .select("*")
              .eq("project_id", projectId)
              .ilike("name", companyName)
              .maybeSingle()) as { data: Organization | null };

            if (existingOrg) {
              organizationId = existingOrg.id;
              orgCache.set(companyName.toLowerCase(), existingOrg.id);
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
                  annual_revenue: parseNumericValue(
                    getValue(row, mapping.annual_revenue),
                  ),
                  market_cap: parseNumericValue(
                    getValue(row, mapping.market_cap),
                  ),
                  funding_stage: getValue(row, mapping.funding_stage),
                  total_funding: parseNumericValue(
                    getValue(row, mapping.total_funding),
                  ),
                })
                .select("*")
                .single()) as {
                data: Organization | null;
                error: Error | null;
              };

              if (orgError) {
                consola.error(
                  `[import-people] Failed to create org ${companyName}:`,
                  orgError,
                );
              } else if (newOrg) {
                organizationId = newOrg.id;
                orgCache.set(companyName.toLowerCase(), newOrg.id);
                orgsCreated++;
              }
            }
          }
        }

        // Create or update person - note: 'name' is a generated column from firstname + lastname
        const displayName =
          fullName || `${firstname || ""} ${lastname || ""}`.trim();
        let personId: string;

        // Build contact_info JSONB for flexible fields (social profiles, website, address)
        const contactInfo: Record<string, string> = {};
        const twitter = getValue(row, mapping.twitter);
        const instagram = getValue(row, mapping.instagram);
        const tiktok = getValue(row, mapping.tiktok);
        const website = getValue(row, mapping.website);
        const address = getValue(row, mapping.address);
        if (twitter) contactInfo.twitter = twitter;
        if (instagram) contactInfo.instagram = instagram;
        if (tiktok) contactInfo.tiktok = tiktok;
        if (website) contactInfo.website = website;
        if (address) contactInfo.address = address;

        if (existingPersonId) {
          // Upsert mode: update existing person
          personId = existingPersonId;
          peopleUpdated++;
          consola.info(
            `[import-people] Row ${i}: Updating existing person ${displayName} (${existingPersonId})`,
          );
        } else {
          // Create new person
          const { data: newPerson, error: personError } = (await (
            supabase as any
          )
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
              // Store flexible contact info (social profiles, website, address)
              contact_info:
                Object.keys(contactInfo).length > 0 ? contactInfo : undefined,
            })
            .select("*")
            .single()) as {
            data: Person | null;
            error: { message: string; code?: string } | null;
          };

          if (personError || !newPerson) {
            const reason = `DB insert failed: ${personError?.message || "Unknown error"} (code: ${personError?.code || "unknown"})`;
            consola.error(
              `[import-people] Row ${i}: Failed to create person ${displayName}:`,
              personError,
            );
            skipReasons.push({
              rowIndex: i,
              reason,
              data: { displayName, firstname, lastname, email },
            });
            skipped++;
            continue;
          }

          personId = newPerson.id;
          peopleCreated++;

          // Link person to organization (only for new people)
          if (organizationId) {
            await (supabase as any).from("people_organizations").insert({
              person_id: personId,
              organization_id: organizationId,
              role: getValue(row, mapping.title) || getValue(row, mapping.role),
              is_primary: true,
            });
          }
        }

        if (personId) {
          if (email) {
            existingEmails.add(email.toLowerCase());
          }

          // Collect facet observations for this person
          const facetObservations: FacetObservation[] = [];

          // Map spreadsheet fields to person facets
          // Note: company_stage and company_size are stored on organizations, not as person facets
          const facetFields: Array<{
            field: keyof ColumnMapping;
            kindSlug: string;
          }> = [
            { field: "segment", kindSlug: "persona" },
            { field: "lifecycle_stage", kindSlug: "persona" },
            { field: "role", kindSlug: "role" },
            { field: "industry", kindSlug: "industry" },
            { field: "location", kindSlug: "location" },
          ];

          for (const { field, kindSlug } of facetFields) {
            const value = getValue(row, mapping[field]);
            if (value) {
              facetObservations.push({
                kind_slug: kindSlug,
                value: value,
                source: "document", // Imported from spreadsheet
                confidence: 0.9, // High confidence since it's explicit data
              });
            }
          }

          // Add custom facet columns including LLM-suggested facets (with defensive handling)
          for (const facetCol of allFacetColumns) {
            // Handle both object format and string format (in case LLM passes wrong format)
            let column: string | undefined;
            let facetKind: string | undefined;

            if (typeof facetCol === "object" && facetCol !== null) {
              column = facetCol.column;
              facetKind = facetCol.facetKind;
            } else if (typeof facetCol === "string") {
              // LLM passed a string instead of object - skip with warning
              consola.warn(
                `[import-people] Skipping malformed facetColumn (expected object, got string): ${facetCol}`,
              );
              continue;
            }

            if (!column || !facetKind) {
              consola.warn(
                "[import-people] Skipping facetColumn with missing column or facetKind:",
                facetCol,
              );
              continue;
            }

            const value = getValue(row, column);
            if (value) {
              facetObservations.push({
                kind_slug: facetKind,
                value: value,
                source: "document",
                confidence: 0.9,
              });
            }
          }

          // Store facet observations for batch processing
          if (facetObservations.length > 0) {
            facetObservationsByPerson.push({
              personId: personId,
              facets: facetObservations,
            });
          }

          importedDetails.push({
            personId: personId,
            name: displayName,
            organizationId,
            organizationName,
            rowIndex: i,
          });
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
      });

      // Persist facet observations for all imported people
      let facetsCreated = 0;
      if (facetObservationsByPerson.length > 0 && projectId) {
        try {
          await persistFacetObservations({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            db: supabase as any,
            accountId,
            projectId,
            observations: facetObservationsByPerson.map((o) => ({
              personId: o.personId,
              facets: o.facets,
              scales: [],
            })),
            evidenceIds: [], // No evidence IDs for imported data
          });
          facetsCreated = facetObservationsByPerson.reduce(
            (sum, o) => sum + o.facets.length,
            0,
          );
          consola.info(
            `[import-people] Created ${facetsCreated} facet observations for ${facetObservationsByPerson.length} people`,
          );
        } catch (facetError) {
          consola.warn(
            "[import-people] Failed to persist facet observations:",
            facetError,
          );
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
      });

      const assetTitle = (asset as { title?: string }).title || "spreadsheet";
      const message = `Imported ${peopleCreated} people${peopleUpdated > 0 ? `, updated ${peopleUpdated}` : ""} and ${orgsCreated} organizations from "${assetTitle}".${facetsCreated > 0 ? ` Created ${facetsCreated} facets.` : ""} ${skipped > 0 ? `Skipped ${skipped} rows.` : ""}`;

      consola.info(`[import-people] ${message}`);
      if (skipReasons.length > 0) {
        consola.warn("[import-people] Skip reasons:", skipReasons.slice(0, 5));
      }

      return {
        success: true,
        message,
        imported: {
          people: peopleCreated,
          updated: peopleUpdated,
          organizations: orgsCreated,
          facets: facetsCreated,
          skipped,
        },
        details: importedDetails.slice(0, 20), // Limit details to first 20
        detectedMapping: mapping as Record<string, string>,
        skipReasons: skipReasons.slice(0, 10), // Include first 10 skip reasons for debugging
      };
    } catch (error) {
      consola.error("[import-people] Error:", error);
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
      };
    }
  },
});
