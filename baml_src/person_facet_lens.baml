// Summarize a person's facet clusters into short takeaways for lens UI

class FacetSignalInput {
  label string @description("Human-readable facet label or alias")
  source string | null @description("Where this facet came from: transcript-derived, manual, survey, etc.")
  confidence float | null @description("0-1 confidence about this facet")
}

class FacetGroupInput {
  kind_slug string @description("Facet kind, e.g., demographic, task, workflow, pain, goal, value")
  kind_label string | null @description("Pretty label for the kind")
  facets FacetSignalInput[] @description("Distinct facets belonging to this kind")
}

class PersonLensMetadata {
  person_id string @description("People table id")
  name string | null @description("Display name")
  title string | null @description("Job title/role label")
  company string | null @description("Company or organization")
  segment string | null @description("Segment or cohort label")
  persona string | null @description("Assigned persona name, if any")
  quick_facts string[] @description("Short factual strings to seed context (role, segment, company, etc.)")
}

class LensEvidenceHighlight {
  gist string @description("<=200 char gist or quote; keep literal wording from source")
  interview_title string | null @description("Interview title or label")
  interview_date string | null @description("ISO timestamp of evidence interview")
  journey_stage string | null @description("Journey stage, if present")
  topic string | null @description("Tagged topic name")
  support string | null @description("supports | refutes | neutral")
}

class PersonFacetLensRequest {
  person PersonLensMetadata @description("Person context for anchoring tone")
  facet_groups FacetGroupInput[] @description("All facet groups to summarize")
  evidence_highlights LensEvidenceHighlight[] @description("Optional evidence snippets to ground claims")
}

class FacetGroupSummary {
  kind_slug string @description("Facet group being summarized")
  summary string @description("Concise summary capturing key points; can include multiple items if important, avoid fluff")
}

class PersonFacetLensResponse {
  summaries FacetGroupSummary[]
}

function SummarizePersonFacetLens(payload: PersonFacetLensRequest) -> PersonFacetLensResponse {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    You are a research summarizer. For each facet group, write a concise summary capturing the most important signals.
    Style: Similar to pain/gain statements - punchy, concrete, action-oriented, NO FLUFF.

    Rules:
    - Capture ALL key points, even if it means multiple items (e.g., "Struggles with data integration • Needs real-time sync • Limited by legacy APIs")
    - Use bullet separators (•) for multiple distinct points
    - Lead with concrete specifics: actions, pains, goals, workflows, constraints
    - Skip generic qualifiers and filler words
    - Use evidence to ground claims but stay tight
    - Never invent details. If thin, write what you know factually
    - Length: Whatever it takes to capture important signals without fluff (typically 10-40 words)
    - Each group should feel complete, not artificially truncated

    {{ _.role("user") }}
    PERSON CONTEXT:
    {{ payload.person }}

    FACET GROUPS:
    {{ payload.facet_groups }}

    EVIDENCE HIGHLIGHTS:
    {{ payload.evidence_highlights }}

    Respond with {{ ctx.output_format }} containing summaries for every facet group.
  "#
}
