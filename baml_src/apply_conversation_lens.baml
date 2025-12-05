// Generic lens application that works with any template definition
// This is the dynamic engine that drives all conversation lenses

class LensFieldValue {
  field_key string @description("Matches field_key from template")
  value string @description("Extracted value or summary")
  confidence float @description("0.0-1.0 confidence score")
  evidence_ids string[] @description("IDs of supporting evidence")
}

class LensSectionResult {
  section_key string @description("Matches section_key from template")
  fields LensFieldValue[] @description("Extracted field values")
}

class LensEntityResult {
  entity_type string @description("e.g., stakeholders, objections, next_steps")
  items LensEntityItem[] @description("Extracted entities")
}

class LensEntityItem {
  name string
  role string?
  description string?
  confidence float
  evidence_ids string[]
}

class LensRecommendation {
  type string @description("next_step, follow_up, risk, opportunity")
  description string
  priority "high" | "medium" | "low"
  rationale string?
  evidence_ids string[]
}

class ConversationLensResult {
  sections LensSectionResult[]
  entities LensEntityResult[]
  recommendations LensRecommendation[]
  overall_confidence float
  processing_notes string?
}

function ApplyConversationLens(
  template_definition: string,
  template_name: string,
  evidence_json: string,
  interview_context: string,
  custom_instructions: string?
) -> ConversationLensResult {
  client CustomGPT4o
  prompt #"
    You are an expert conversation analyst. Apply the following analytical lens/framework
    to extract structured insights from interview evidence.

    ## Template: {{ template_name }}
    {{ template_definition }}

    ## Interview Context
    {{ interview_context }}

    {% if custom_instructions %}
    ## Custom Instructions
    {{ custom_instructions }}
    {% endif %}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions
    1. For each section and field defined in the template, extract the relevant information
    2. Always cite evidence_ids that support each extraction
    3. Assign confidence scores based on how directly the evidence supports the extraction
    4. Generate actionable recommendations based on the analysis
    5. If a field cannot be determined from the evidence, indicate low confidence
    6. For entities (stakeholders, next_steps, etc.), extract all relevant items mentioned

    {{ ctx.output_format }}
  "#
}
