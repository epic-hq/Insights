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
  summary string @description("1-2 sentence takeaway about this group; concrete, factual, non-fluffy")
}

class PersonFacetLensResponse {
  summaries FacetGroupSummary[]
}

function SummarizePersonFacetLens(payload: PersonFacetLensRequest) -> PersonFacetLensResponse {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    You are a research summarizer. For each facet group, write 1-2 crisp sentences that surface the most practical signals.
    Rules:
    - Lead with concrete facts (role/company/segment) only if they sharpen the takeaway.
    - Prefer actions, pains, goals, workflows, constraints over adjectives.
    - Pull in evidence highlights for flavor but keep them short; attribute stage/topic when obvious.
    - Never invent details. If a group is thin, acknowledge briefly and stay factual.
    - Keep each group independent; do not reuse the same sentence across groups.

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
