// Cross-interview synthesis for aggregated lens views
// Takes multiple individual lens analyses and synthesizes key takeaways

class SynthesizedInsight {
  title string @description("Short, actionable title (5-10 words)")
  insight string @description("The key finding or pattern observed across interviews")
  supporting_interviews string[] @description("List of interview_ids that support this insight")
  confidence float @description("0.0-1.0 based on consistency across interviews")
  category "consensus" | "pattern" | "discrepancy" | "recommendation" @description("Type of insight")
}

class FieldSynthesis {
  field_key string @description("The field being synthesized")
  field_name string @description("Human-readable field name")
  consensus_value string? @description("If there's consensus, what is it")
  value_range string? @description("If values vary, show the range")
  discrepancies SynthesisDiscrepancy[]? @description("Notable conflicts or outliers")
  interview_count int @description("Number of interviews with data for this field")
}

class SynthesisDiscrepancy {
  interview_id string
  interview_title string
  value string
  note string @description("Why this is notable or different")
}

class SectionSynthesis {
  section_key string
  section_name string
  summary string @description("2-3 sentence synthesis of this section across all interviews")
  fields FieldSynthesis[]
}

class EntityAggregation {
  entity_type string @description("stakeholders, next_steps, objections, etc.")
  total_count int
  top_items string[] @description("Most frequently mentioned items")
  patterns string? @description("Any patterns observed")
}

class LensSynthesisResult {
  executive_summary string @description("3-5 bullet points with the most important cross-interview insights. Each bullet should be concrete and actionable. Use format: KEY_FINDING: detail")
  key_takeaways SynthesizedInsight[] @description("2-4 synthesized insights from the data")
  sections SectionSynthesis[] @description("Per-section synthesis with field-level rollup")
  entities EntityAggregation[] @description("Aggregated entities across interviews")
  recommendations string[] @description("Actionable next steps based on the synthesis")
  conflicts_to_review string[] @description("Notable discrepancies that need attention")
  overall_confidence float @description("Average confidence across synthesized insights")
  interview_count int @description("Total interviews analyzed")
  synthesis_notes string? @description("Any caveats or methodology notes")
}

function SynthesizeLensInsights(
  template_name: string,
  template_definition: string,
  analyses_json: string,
  custom_instructions: string?
) -> LensSynthesisResult {
  client CustomGPT4o
  prompt #"
    You are an expert at synthesizing insights from multiple conversation analyses.
    You've been given {{ template_name }} lens analyses from multiple interviews.
    Your job is to find patterns, build consensus, and highlight discrepancies.

    ## Lens Template
    {{ template_definition }}

    ## Individual Interview Analyses
    {{ analyses_json }}

    {% if custom_instructions %}
    ## Custom Instructions
    {{ custom_instructions }}
    {% endif %}

    ## Synthesis Instructions

    ### Executive Summary
    Create a 3-5 bullet executive summary using this format:
    - KEY_FINDING: Specific detail (N interviews)

    Example:
    - BUDGET CONSENSUS: $50-100K range confirmed across 4/5 prospects
    - TIMELINE RISK: 60% have hard Q2 deadlines, 2 need faster
    - TOP PAIN: Manual data entry mentioned in 8/10 interviews
    - MISSING: No technical evaluator identified in 3 deals

    ### Key Takeaways
    Identify 2-4 major insights:
    - "consensus" - Agreement across multiple interviews
    - "pattern" - Recurring theme or behavior
    - "discrepancy" - Notable conflict requiring attention
    - "recommendation" - Action to take based on findings

    ### Section Synthesis
    For each section in the template:
    1. Write a 2-3 sentence summary of findings across all interviews
    2. For each field, determine:
       - consensus_value: If most interviews agree, what's the answer
       - value_range: If values vary, show the spectrum
       - discrepancies: Call out any outliers that need review

    ### Entity Aggregation
    Aggregate entities (stakeholders, next_steps, objections) across interviews:
    - Count total occurrences
    - List most common items
    - Note any patterns

    ### Recommendations
    Based on the synthesis, provide 3-5 actionable recommendations.

    ### Conflicts to Review
    List any significant discrepancies that need human review.

    {{ ctx.output_format }}
  "#
}
