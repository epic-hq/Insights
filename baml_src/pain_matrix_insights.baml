// Pain Matrix Insights Generation

class PainMatrixInsightsInput {
  total_pains int @description("Total number of pain themes identified")
  total_groups int @description("Total number of user segments/groups")
  total_evidence int @description("Total evidence items analyzed")
  high_impact_cells int @description("Number of high-impact pain×segment combinations (impact ≥2.0)")

  top_pains TopPainCell[] @description("Top 5-10 pain×segment combinations by impact score")
}

class TopPainCell {
  pain_name string @description("Name of the pain theme")
  user_group string @description("Name of the user segment")
  impact_score float @description("Impact score (person_count × intensity × willingness_to_pay)")
  frequency float @description("Frequency as decimal (0.0-1.0)")
  intensity string @description("Intensity level: low, medium, high, critical")
  willingness_to_pay string @description("WTP level: low, medium, high")
  person_count int @description("Number of people affected")
  evidence_count int @description("Number of evidence items")
  sample_quote string | null @description("Sample verbatim quote from evidence")
}

class PainMatrixInsights {
  summary string @description("1-2 sentence summary of the biggest opportunity (most impactful pain). Be specific with numbers.")
  top_3_actions string[] @description("Exactly 3 bullet points: what to build/fix first, based on impact scores. Format: '[Pain] for [segment]: [score] impact'")
}

function GeneratePainMatrixInsights(
  matrix_data: PainMatrixInsightsInput
) -> PainMatrixInsights {
  client CustomGPT4oMini
  prompt #"
    Analyze this pain matrix and provide actionable insights.

    Data:
    - {{ matrix_data.total_pains }} pains, {{ matrix_data.total_groups }} segments, {{ matrix_data.total_evidence }} evidence items
    - {{ matrix_data.high_impact_cells }} high-impact cells (≥1.0)

    Top pains by impact:
    {{ matrix_data.top_pains }}

    Rules:
    - Be direct. No corporate speak.
    - If sample size is small (< 30 evidence items) or segments have < 3 people, call it out as low confidence and recommend more interviews
    - Use actual pain names and segment names from the data
    - Include impact scores (1 decimal) in your recommendations
    - Focus on the top 3 highest-impact opportunities

    Output format:
    {{ ctx.output_format }}
  "#
}
