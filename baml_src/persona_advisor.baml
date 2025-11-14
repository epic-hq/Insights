// Generate persona story reports that mirror the Opportunity AI Advisor structure.

class PersonaAdvisorFacetInput {
  label string @description("Facet label or alias that should be echoed in the persona copy")
  kind_slug string @description("Facet kind such as motivation, value, pain, goal, habit, constraint, preference")
  confidence float | null @description("Normalized 0-1 confidence score")
  source string | null @description("Source of the signal, e.g., transcript, survey, manual")
}

class PersonaAdvisorScaleInput {
  kind_slug string @description("Scale slug such as adoption_stage, urgency, satisfaction, readiness")
  score float | null @description("Numeric score, if available")
  band string | null @description("Qualitative band like high, medium, low, early, late")
  source string | null @description("Where the scale comes from")
  confidence float | null @description("0-1 confidence for this measurement")
}

class PersonaAdvisorThemeInput {
  title string @description("Theme or insight title")
  description string | null @description("Brief summary or details of the insight")
  pain string | null @description("Pain description captured by the theme")
  desired_outcome string | null @description("Desired outcome or benefit")
  emotional_response string | null @description("Emotional language attached to the insight, if any")
  journey_stage string | null @description("Journey stage such as discovery, evaluation, use")
  category string | null @description("Business or product category label")
  evidence string[] | null @description("Supporting evidence snippets or quotes")
  persona_count int | null @description("How many personas reference this theme")
  priority int | null @description("Priority score for ordering the theme")
}

class ResearchInsightInput {
  title string
  summary string
  source string | null
  evidence string[] | null
}

class PersonaAdvisorPersonaInput {
  name string
  tagline string | null
  description string | null
  quick_facts string[]
  people_count int
  percent float | null
  motivations string[] | null
  frustrations string[] | null
  values string[] | null
  goals string[] | null
  primary_goal string | null
  secondary_goals string[] | null
  preferences string | null
  tech_comfort_level string | null
  key_tasks string[] | null
  tools_used string[] | null
  quotes string[] | null
  facets PersonaAdvisorFacetInput[]
  scales PersonaAdvisorScaleInput[]
  themes PersonaAdvisorThemeInput[]
}

class PersonaAdvisorContext {
  project_name string
  project_description string | null
  personas PersonaAdvisorPersonaInput[]
  research_insights ResearchInsightInput[]
  shared_themes PersonaAdvisorThemeInput[]
  total_personas int
  total_people int
}

class PersonaAdvisorReport {
  markdown string
}

function GeneratePersonaAdvisorReport(context: PersonaAdvisorContext) -> PersonaAdvisorReport {
  client CustomGPT4o
  prompt #"
    {{ _.role("system") }}
    You are a senior research partner embedded with a product team. Your job is to translate persona data into a crisp, structured markdown report that mirrors the example structure below.

    {{ _.role("user") }}
    Use the data below to synthesize Persona narratives, shared insights, feature priorities, and positioning guidance.

    PROJECT CONTEXT:
    - name: {{ context.project_name }}
    {% if context.project_description %}- description: {{ context.project_description }}{% endif %}

    PERSONAS:
    {{ context.personas }}

    SHARED THEMES:
    {{ context.shared_themes }}

    RESEARCH INSIGHTS:
    {{ context.research_insights }}

    TOTAL PERSONAS: {{ context.total_personas }}
    TOTAL PARTICIPANTS: {{ context.total_people }}

    REPORT FORMAT (match this structure as closely as possible; use markdown headings, bullet lists, and tables):

    Persona #1 The Name
    "Optional representative quote."

    Who They Are: <1 short paragraph that references quick facts, the description, and any relevant scale bands.

    Pain Points:
    - ... (extract 3-4 pains from frustrations, facets, scales, or theme pain strings)

    Motivations:
    - ... (use motivations, values, and facets that read as drivers)

    What They Love in the product:
    - ... (tie to themes or positive facets, mention desired outcomes or emotional language)

    User Quotes for recent interviews:
    - "Quote 1"
    - "Quote 2"

    Repeat the persona block for each persona, numbering them in order.

    💡Shared Insights Across Personas - What they both want
    Shared Values:
    - ... (use common values or motivation language across personas)
    Top Feature Priorities:
    - ... (draw from the shared themes and persona facets)
    Positioning Guidance:
    - "Two supporting positioning lines that reframe the product narrative"

    🎯 Key Themes to Prioritize in Product & Messaging
    Priority | Theme | Why It Matters
    --- | --- | ---
    High | Theme name | Tie in pain, desired outcome, or emotional response (include persona_count when helpful)
    Medium | ...

    🧩 Summary: Overlap in Features & Values
    [Summarize 3 rows in table form or short bullets about reliability, reflection, meaning, privacy, etc.]

    ---

    Research Insights: The Performative Nature of Social Media
    1. Title of research insight
    Summary and evidence (cite source)

    Problem Framing
    <1-2 paragraphs that spotlight the shared tensions revealed by the data and tie back to your product narrative>

    Pull quotes from context.quotes when possible and cite research_insights evidence when you can. Mention scale bands when they explain urgency or readiness. Frame the report around privacy, emotion, and meaningful capture, but do not invent data that is not present. If a section cannot be supported by the data, explain that it is speculative.

    Return only valid markdown in the report string and nothing else.

    Respond with {{ ctx.output_format }}.
  "#
}
