// Map spreadsheet columns to CRM fields using LLM intelligence
// This provides accurate column mapping for contact/people imports
//
// 2-Step Validation Flow:
// 1. parseSpreadsheet → MapSpreadsheetColumns (this function) → saves to project_assets
// 2. User reviews/confirms → importPeopleFromTable → creates CRM records
//
// The LLM analysis provides:
// - column_mapping: Standard CRM field mappings
// - suggested_facets: Custom columns (event signups, surveys) to import as facets
// - unmapped_columns: Columns that couldn't be classified
// - warnings: Data quality issues to review before import

class SpreadsheetColumnMapping {
  // Name fields - IMPORTANT: Only set ONE of these based on the actual column structure
  // If there's a single "Name" column with full names like "John Smith", set `name` and leave firstname/lastname null
  // If there are separate "First Name" and "Last Name" columns, set those and leave `name` null
  name string? @description("Column containing FULL NAME (e.g., 'John Smith'). Only set if there's a single combined name column.")
  firstname string? @description("Column containing FIRST NAME ONLY (e.g., 'John'). Only set if there's a separate first name column.")
  lastname string? @description("Column containing LAST NAME ONLY (e.g., 'Smith'). Only set if there's a separate last name column.")

  // Primary contact info
  email string? @description("Column containing email address")
  phone string? @description("Column containing phone number")
  website string? @description("Column containing personal or company website URL")
  address string? @description("Column containing full mailing/street address")

  // Social profiles
  linkedin string? @description("Column containing LinkedIn URL or profile handle")
  twitter string? @description("Column containing Twitter/X URL or @handle")
  instagram string? @description("Column containing Instagram URL or handle")
  tiktok string? @description("Column containing TikTok URL or handle")

  // Professional info
  title string? @description("Column containing job title (e.g., 'VP of Sales', 'Software Engineer')")
  company string? @description("Column containing company/organization name")
  role string? @description("Column containing role or job function (if different from title)")
  industry string? @description("Column containing industry or sector")
  location string? @description("Column containing location, city, or region (not full address)")

  // Company context
  company_stage string? @description("Column containing company stage (Startup, Growth, Enterprise) or funding stage")
  company_size string? @description("Column containing employee count or size range (1-10, 11-50, etc.)")

  // Company metrics
  company_url string? @description("Column containing company website URL or domain")
  annual_revenue string? @description("Column containing company annual revenue (ARR, revenue, etc.)")
  market_cap string? @description("Column containing company market capitalization")
  funding_stage string? @description("Column containing funding stage (Seed, Series A, Series B, Pre-IPO, etc.)")
  total_funding string? @description("Column containing total funding raised amount")

  // Segmentation
  segment string? @description("Column containing customer segment or type")
  lifecycle_stage string? @description("Column containing lifecycle stage or lead status")
}

class SpreadsheetAnalysis {
  column_mapping SpreadsheetColumnMapping @description("Mapping of spreadsheet columns to CRM fields")
  confidence float @description("Confidence score 0-1 for the mapping accuracy")
  unmapped_columns string[] @description("Columns that don't map to standard CRM fields - these could be custom facets")
  suggested_facets SuggestedFacet[] @description("Suggestions for unmapped columns that could be imported as facets")
  warnings string[] @description("Any warnings or issues detected with the data")
}

class SuggestedFacet {
  column string @description("The column name from the spreadsheet")
  facet_kind string @description("Suggested facet kind slug: 'event' (event signups), 'survey_response' (form answers), 'preference' (interests/choices), 'tool' (software used), 'custom' (other)")
  sample_values string[] @description("2-3 example values from the column to help understand the data")
  reason string @description("Why this column should be a facet")
}

function MapSpreadsheetColumns(
  headers: string[],
  sample_rows: string[][],
  data_context: string?
) -> SpreadsheetAnalysis {
  client CustomGPT4oMini
  prompt #"
    You are an expert at analyzing spreadsheet data and mapping columns to CRM fields.

    CRITICAL RULES FOR NAME MAPPING:
    1. If there is ONE column with full names (like "Name" containing "John Smith"), map it to `name` ONLY
    2. If there are TWO separate columns for first and last name, map them to `firstname` and `lastname`
    3. NEVER map the same column to multiple name fields
    4. NEVER map a full name column to firstname or lastname - that causes data corruption

    Look at the ACTUAL DATA VALUES to determine the column type:
    - "John Smith" = full name → use `name`
    - "John" in one column, "Smith" in another = separate → use `firstname` and `lastname`

    SOCIAL PROFILE DETECTION:
    - twitter: Twitter, X, @handle columns → look for twitter.com URLs or @handles
    - instagram: Instagram, IG columns → look for instagram.com URLs or handles
    - tiktok: TikTok columns → look for tiktok.com URLs or handles
    - linkedin: LinkedIn columns → look for linkedin.com URLs

    ADDRESS vs LOCATION:
    - address: Full mailing address with street, city, zip (e.g., "123 Main St, NYC 10001")
    - location: City, region, or country only (e.g., "New York", "US", "EMEA")

    COMPANY CONTEXT:
    - company_stage: Startup, Growth, Series A, Enterprise, etc.
    - company_size: Employee counts or ranges (1-10, 50-200, etc.)

    COMPANY METRICS (important for B2B data):
    - company_url: Company website, domain, URL columns
    - annual_revenue: Revenue, ARR, Annual Revenue columns → look for dollar amounts or revenue figures
    - market_cap: Market Cap, Valuation columns → look for large dollar figures
    - funding_stage: Funding Stage, Round columns → Seed, Series A, Series B, Pre-IPO, etc.
    - total_funding: Total Funding, Funding Raised columns → look for dollar amounts

    Given these spreadsheet headers and sample data, analyze and map the columns.

    Headers: {{ headers }}

    Sample rows (first 5):
    {% for row in sample_rows %}
    Row {{ loop.index }}: {{ row }}
    {% endfor %}

    {% if data_context %}
    Additional context: {{ data_context }}
    {% endif %}

    Instructions:
    1. Examine each column header AND the sample data values
    2. Map columns to the appropriate CRM fields based on BOTH header names AND actual values
    3. For name columns: Look at the VALUES to determine if it's full name or first/last
    4. Identify columns that don't fit standard fields but could be valuable as facets
    5. For custom columns (event questions, survey answers, preferences), suggest as facets with:
       - facet_kind: 'event' for event signups, 'survey_response' for form answers, 'preference' for interests, 'custom' for other
       - sample_values: Include 2-3 example values from the data
    6. Flag any data quality issues or ambiguities in warnings

    Return your analysis as a SpreadsheetAnalysis object.

    {{ ctx.output_format }}
  "#
}
