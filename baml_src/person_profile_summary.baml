// Generate concise participant descriptions from facet + scale data

class PersonFacetInput {
  label string @description("Facet label or alias that should be echoed in the summary when relevant")
  kind_slug string @description("Facet kind slug such as demographic, task, workflow, preference, pain, goal, or value")
  source string | null @description("Source of the facet (e.g., transcript-derived, manual)")
  confidence float | null @description("0-1 confidence of the facet")
}

class PersonScaleInput {
  kind_slug string @description("Scale identifier, e.g., adoption_stage, urgency, satisfaction")
  score float | null @description("Numeric scale score if available")
  band string | null @description("Qualitative band derived from the score (e.g., high, medium, low)")
  source string | null @description("Source of the scale reading")
  confidence float | null @description("0-1 confidence in this measurement")
}

class PersonEvidenceHighlight {
  gist string @description("<=200 character gist or quote taken directly from interview evidence. No embellishment.")
  interview_title string | null @description("Interview title or internal label for context")
  interview_date string | null @description("ISO timestamp for when the interview occurred")
  journey_stage string | null @description("Journey stage noted on the evidence, if any")
  topic string | null @description("Tagged topic for the evidence snippet")
  support string | null @description("Support classification: supports | refutes | neutral")
}

class PersonProfileInput {
  person_id string @description("Database ID for the person record")
  name string | null @description("Preferred name")
  title string | null @description("Job title or role label")
  role string | null @description("Functional role if distinct from title")
  company string | null @description("Company or organization")
  segment string | null @description("Segment or cohort label")
  persona string | null @description("Assigned persona name, if any")
  quick_facts string[] @description("Short factual statements derived from demographics or metadata")
  facets PersonFacetInput[] @description("Distinct persona facets for the participant")
  scales PersonScaleInput[] @description("Quantitative scale signals such as adoption, urgency, or satisfaction")
  evidence_highlights PersonEvidenceHighlight[] @description("Up to 6 concise interview gists that add color to the profile")
}

class PersonDescriptionSummary {
  summary string @description("Describe the type of person in 3-5 short sentences. Each sentence should convey a concrete behavioral, motivational, or contextual point without fluff. Just the facts, as clearly as possible.")
}

function SummarizePersonProfile(profile: PersonProfileInput) -> PersonDescriptionSummary {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    You are a product researcher summarizing a single participant using curated persona facets.
    Produce 3-5 crisp sentences that capture the most decision-relevant facts:
    - Reference the strongest facets (tasks, pains, motivations, workflows, constraints).
    - Tie in scale bands or scores when they clarify urgency or maturity.
    - Fold quick_facts into the first sentence for fast context (role, segment, company, persona).
    - Weave in 1-2 evidence_highlights so each summary has a concrete anecdote or quote; keep them short and attribute context (stage, topic, or interview title) when possible.
    - Avoid flowery language, filler, and assumptions not supported by the data.
    - Prefer concrete verbs/nouns over adjectives. Mention only what appears in the input.

    {{ _.role("user") }}
    PARTICIPANT PROFILE:
    {{ profile }}

    Respond with {{ ctx.output_format }}.
  "#
}
