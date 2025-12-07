// Generic lens application that works with any template definition
// This is the dynamic engine that drives all conversation lenses

class LensFieldValue {
  field_key string @description("Matches field_key from template")
  value string @description("Extracted value or summary")
  confidence float @description("0.0-1.0 confidence score")
  evidence_ids string[] @description("IDs of supporting evidence (use 8-char prefix)")
}

class LensSectionResult {
  section_key string @description("Matches section_key from template")
  summary string @description("Punchy 1-2 sentence summary of this section's key findings. Use bullet separators (•) for multiple distinct points. Concrete, action-oriented, no fluff.")
  fields LensFieldValue[] @description("Extracted field values")
}

// Rich entity types for different entity categories
class LensStakeholderItem {
  name string @description("Person's name as mentioned in conversation")
  role string? @description("Job title or role mentioned")
  influence "low" | "medium" | "high" | null @description("Decision-making influence level")
  labels string[] @description("Labels like 'economic_buyer', 'champion', 'blocker', 'technical_evaluator', 'end_user'")
  email string? @description("Email if mentioned")
  organization string? @description("Company/org name if mentioned")
  confidence float
  evidence_ids string[]
}

class LensNextStepItem {
  description string @description("What needs to be done")
  owner string? @description("Who is responsible (name)")
  due_date string? @description("When it's due (ISO date or relative like 'next week')")
  status "pending" | "in_progress" | "completed" | null @description("Current status if known")
  priority "high" | "medium" | "low" | null
  confidence float
  evidence_ids string[]
}

class LensObjectionItem {
  objection string @description("The concern or objection raised")
  type string @description("Category: price, timing, competition, technical, stakeholder, other")
  status "raised" | "addressed" | "unresolved" | null @description("Current status")
  response string? @description("How it was addressed, if at all")
  confidence float
  evidence_ids string[]
}

class LensEntityResult {
  entity_type "stakeholders" | "next_steps" | "objections" | "other" @description("Type of entities in this group")
  stakeholders LensStakeholderItem[]? @description("Populated when entity_type is 'stakeholders'")
  next_steps LensNextStepItem[]? @description("Populated when entity_type is 'next_steps'")
  objections LensObjectionItem[]? @description("Populated when entity_type is 'objections'")
}

class LensHygieneItem {
  code string @description("Identifier like 'missing_budget', 'missing_timeline', 'no_champion'")
  severity "info" | "warning" | "critical"
  message string @description("Human-readable description of the gap")
  field_key string? @description("Related field if applicable")
}

class LensRecommendation {
  type string @description("next_step, follow_up, risk, opportunity")
  description string
  priority "high" | "medium" | "low"
  rationale string?
  evidence_ids string[]
}

class ConversationLensResult {
  executive_summary string @description("TLDR: 2-3 sentence executive summary of the entire lens analysis. Lead with the most important finding or status. Concrete, direct, actionable.")
  sections LensSectionResult[]
  entities LensEntityResult[]
  recommendations LensRecommendation[]
  hygiene LensHygieneItem[] @description("Missing or incomplete information warnings")
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

    ### Executive Summary (TLDR)
    1. Start with a 2-3 sentence executive_summary that captures the most important takeaway
       - Lead with status/verdict (e.g., "Strong alignment on goals but timeline risks unresolved")
       - Be concrete and actionable, not generic
       - This is what someone reads if they only have 10 seconds

    ### Section Extraction
    2. For each section, provide BOTH:
       - **summary**: Punchy 1-2 sentence summary of key findings. Use bullet separators (•) for multiple points.
         Style: "Client wants faster onboarding • Success = 50% reduction in setup time • Hard deadline: Q2 launch"
       - **fields**: Detailed field-by-field extraction (see below)

    3. For each field defined in the template, extract the relevant information
    4. **CRITICAL**: Always populate the `value` field with actual extracted text from the evidence:
       - For text fields: Extract a summary or direct quote
       - For text_array fields: Extract multiple items as a list of strings
       - Never leave value empty if you have evidence_ids - synthesize the content from those evidence items
       - For monetary/numeric fields like "deal_size", "budget", "potential value": Extract as dollar amounts (e.g., "$50K", "$100,000", "$50-100K range")
    5. Always cite evidence_ids (use the 8-character ID prefix) that support each extraction
    6. Assign confidence scores (0.0-1.0) based on how directly the evidence supports the extraction
    7. Only omit a field entirely if there is truly no relevant evidence - do NOT include a field with evidence_ids but empty value

    ### Entity Extraction
    8. **Stakeholders**: Extract ALL people mentioned with decision-making relevance:
       - Include their role/title if mentioned
       - Assess influence level (high = final decision maker, medium = key influencer, low = end user)
       - Apply labels: economic_buyer, champion, blocker, technical_evaluator, end_user, coach
       - Include email and organization if mentioned

    9. **Next Steps**: Extract ALL action items, commitments, or follow-ups mentioned:
       - Include who owns the action if stated
       - Include due dates or timeframes if mentioned
       - Set status based on context (pending if future, completed if done)
       - Set priority based on urgency signals

    10. **Objections**: Extract concerns, pushback, or blockers raised:
        - Categorize by type (price, timing, competition, technical, stakeholder, other)
        - Note if/how the objection was addressed
        - Track status (raised, addressed, unresolved)

    ### Hygiene Checks
    11. Generate hygiene warnings for missing critical information:
        - missing_budget: No budget/pricing discussion
        - missing_timeline: No timeline or urgency mentioned
        - missing_authority: Decision maker not identified
        - missing_need: Core pain/need not clearly articulated
        - no_champion: No internal advocate identified
        - unaddressed_objection: Objection raised but not resolved

    ### Recommendations
    12. Generate actionable recommendations based on gaps and opportunities discovered

    {{ ctx.output_format }}
  "#
}
