// Generate AI-powered recommended next steps for a specific person
// Based on their profile, conversation history, themes, and relationship context

class PersonNextStepsInput {
  name string | null @description("Person's name")
  title string | null @description("Job title")
  company string | null @description("Company or organization name")
  description string | null @description("AI-generated person summary, if available")
  icp_band string | null @description("ICP match band: HIGH, MEDIUM, LOW, or null")
  icp_score float | null @description("ICP match score 0-1")
  days_since_last_contact int | null @description("Days since last interaction, null if never contacted")
  conversation_count int @description("Total number of conversations/interviews")
  survey_count int @description("Total number of survey responses")
  themes string[] @description("Theme names this person's evidence supports, ordered by evidence count")
  recent_evidence string[] @description("Up to 5 recent evidence gists/quotes from this person")
  facets string[] @description("Person facet labels (e.g., pain points, goals, workflows)")
}

class PersonNextStep {
  action string @description("Concrete, actionable recommendation in imperative form. 10-15 words max. E.g., 'Schedule a follow-up to explore their pricing concerns'")
  reasoning string @description("Brief context explaining WHY this step matters for this specific person. 1 sentence, under 20 words.")
  priority int @description("1 = most urgent, 2 = important, 3 = nice to have")
}

class PersonNextStepsOutput {
  steps PersonNextStep[] @description("Exactly 3 recommended next steps, ordered by priority (1 first)")
}

function GeneratePersonNextSteps(input: PersonNextStepsInput) -> PersonNextStepsOutput {
  client CustomGPT4oMini
  prompt #"
    {{ _.role("system") }}
    You are a customer research advisor helping a product team decide what to do next with a specific contact.

    Your recommendations must be:
    - SPECIFIC to this person's data (reference their themes, pain points, or quotes)
    - ACTIONABLE with a clear verb (schedule, send, review, ask, share, investigate)
    - PRIORITIZED by impact and urgency
    - VARIED — do not suggest 3 versions of the same action

    Consider these factors when prioritizing:
    1. RECENCY: Stale relationships (>14 days) need re-engagement
    2. DEPTH: Few conversations = need more discovery; many = ready for validation
    3. ICP FIT: High-fit contacts deserve more investment
    4. THEMES: Unresolved pain points or goals are opportunities
    5. EVIDENCE GAPS: Missing survey data or shallow theme coverage

    Do NOT suggest:
    - Generic actions like "stay in touch" or "keep building the relationship"
    - Actions that require data you don't have
    - More than one follow-up/scheduling action

    {{ _.role("user") }}
    PERSON CONTEXT:
    {{ input }}

    Return exactly 3 next steps ordered by priority.

    {{ ctx.output_format }}
  "#
}
