// Cross-lens synthesis: takes ALL lens analyses across a project and produces
// an executive-level summary that spans every lens type.
//
// Unlike per-lens synthesis (which only looks at one template at a time),
// this function sees the full picture: BANT + Discovery + Empathy + custom lenses
// combined into a single overview with key findings and recommended actions.

class CrossLensFinding {
  title string @description("Short headline, 5-10 words")
  description string @description("2-3 sentence explanation of the finding")
  severity "critical" | "important" | "notable"
  people_count int @description("How many unique people this finding relates to")
  mention_count int @description("Total mentions across all lenses")
  category string @description("Topic bucket: pricing, product, onboarding, competition, etc.")
  supporting_lenses string[] @description("Which lens templates contributed to this finding")
}

class CrossLensRecommendedAction {
  title string @description("Actionable task title, imperative mood")
  description string @description("Why this matters and what to do")
  priority "high" | "medium" | "low"
  category string @description("Product, Sales, Support, Research, etc.")
}

class PersonSnapshot {
  person_name string
  role string?
  organization string?
  key_needs string[] @description("Top 2-3 needs or pain points")
  engagement_signal string @description("One-line assessment: champion, evaluator, blocker, etc.")
}

class CrossLensSynthesisResult {
  executive_summary string @description("3-5 paragraph overview of ALL findings across ALL lenses. Written for a busy founder/PM. Lead with the most important insight.")
  key_findings CrossLensFinding[] @description("5-8 key findings sorted by severity. Cross-reference across lens types.")
  person_snapshots PersonSnapshot[] @description("Brief snapshot of each person mentioned, with their key needs and engagement level")
  recommended_actions CrossLensRecommendedAction[] @description("3-6 concrete next steps. Prioritized. Each should be actionable.")
  patterns string[] @description("2-4 macro patterns visible only when looking across all lens types")
  risks string[] @description("1-3 risks or blind spots identified")
  overall_confidence float @description("0.0-1.0 average confidence across all analyses")
  analysis_count int
  lens_count int
}

function SynthesizeCrossLensInsights(
  project_context: string,
  lens_summaries_json: string,
  all_analyses_json: string,
  people_context: string?,
  custom_instructions: string?
) -> CrossLensSynthesisResult {
  client CustomGPT4o
  prompt #"
    You are an expert insight synthesizer for a customer intelligence platform.
    You have access to analyses from MULTIPLE different lens types applied to the
    same set of conversations. Your job is to produce a unified executive briefing.

    ## Project Context
    {{ project_context }}

    ## Per-Lens Summaries (already synthesized per lens type)
    {{ lens_summaries_json }}

    ## All Individual Analyses (raw data across all lenses and conversations)
    {{ all_analyses_json }}

    {% if people_context %}
    ## People Context
    {{ people_context }}
    {% endif %}

    {% if custom_instructions %}
    ## Custom Instructions
    {{ custom_instructions }}
    {% endif %}

    ## Instructions

    ### Executive Summary
    Write a 3-5 paragraph overview that a busy founder or PM can read in 60 seconds.
    - Lead with the single most important finding
    - Cross-reference findings across lens types (e.g. "The pricing concerns
      flagged by the Sales BANT lens align with the pain points identified in
      Customer Discovery")
    - Include concrete numbers: "7/10 prospects", "mentioned by 3 people"
    - End with the recommended priority action

    ### Key Findings
    Identify 5-8 findings that emerge from looking across ALL lenses together.
    The power of cross-lens analysis is seeing things no single lens reveals:
    - A BANT-qualified prospect who has deep pains in Discovery = hot lead
    - A pattern in Empathy Maps that contradicts the Discovery lens = investigate
    - Consistent themes across 3+ lens types = high-confidence finding

    Sort by severity: critical > important > notable.
    Track which lenses support each finding.

    ### Person Snapshots
    For each person mentioned across analyses, create a brief snapshot:
    - Their top needs (from any lens)
    - Their engagement signal (champion, evaluator, blocker, neutral)
    - Their role and organization

    ### Recommended Actions
    3-6 concrete, actionable next steps. Each should be specific enough to
    create a task from. Prioritize by impact and urgency.

    ### Patterns
    2-4 macro patterns only visible from the cross-lens view.

    ### Risks
    1-3 blind spots or risks the team should be aware of.

    {{ ctx.output_format }}
  "#
}
