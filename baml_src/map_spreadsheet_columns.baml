// Map spreadsheet columns to CRM fields using LLM intelligence
// This provides accurate column mapping for contact/people imports

class SpreadsheetColumnMapping {
  // Name fields - IMPORTANT: Only set ONE of these based on the actual column structure
  // If there's a single "Name" column with full names like "John Smith", set `name` and leave firstname/lastname null
  // If there are separate "First Name" and "Last Name" columns, set those and leave `name` null
  name string? @description("Column containing FULL NAME (e.g., 'John Smith'). Only set if there's a single combined name column.")
  firstname string? @description("Column containing FIRST NAME ONLY (e.g., 'John'). Only set if there's a separate first name column.")
  lastname string? @description("Column containing LAST NAME ONLY (e.g., 'Smith'). Only set if there's a separate last name column.")

  // Contact info
  email string? @description("Column containing email address")
  phone string? @description("Column containing phone number")
  linkedin string? @description("Column containing LinkedIn URL or profile")

  // Professional info
  title string? @description("Column containing job title (e.g., 'VP of Sales', 'Software Engineer')")
  company string? @description("Column containing company/organization name")
  role string? @description("Column containing role or job function (if different from title)")
  industry string? @description("Column containing industry or sector")
  location string? @description("Column containing location, city, or region")

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
  facet_kind string @description("Suggested facet kind slug (e.g., 'event', 'survey_response', 'tool')")
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
    5. Flag any data quality issues or ambiguities

    Return your analysis as a SpreadsheetAnalysis object.

    {{ ctx.output_format }}
  "#
}
