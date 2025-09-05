// Project Template Fill
// General LLM contract to map signup_data and optional hints to
// a concrete project template filled with helpful, specific defaults.

class ProjectTemplateOut {
  template_key string @description("Identifier of the template, e.g. 'understand_customer_needs'")
  target_orgs string[]
  target_roles string[]
  research_goal string
  research_goal_details string
  decision_questions string[]
  assumptions string[]
  unknowns string[]
  custom_instructions string
}

// This function should be general enough to fill any template in the future
// using the template_key. For now, we primarily support 'understand_customer_needs'.
function FillProjectTemplate(
  template_key: string,
  signup_data: string,
  project_name: string
) -> ProjectTemplateOut {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    You are a senior UX research strategist. Convert messy signup inputs into a
    clean, opinionated project setup tailored to the given template.

    Templates (current + future):
    - understand_customer_needs — Focus on jobs-to-be-done, outcomes, pains, contexts.
    - improve_ecommerce_conversion — Focus on funnel blockers, intent, decision criteria. (future)
    - consulting_stakeholder_interviews — Focus on stakeholder goals, risks, alignment. (future)

    RULES:
    - Be concrete, specific, and helpful. Prefer actionable phrasing over vague terms.
    - Use the user's signup_data when relevant. If data is missing, fill with strong defaults
      for the template.
    - Keep target_orgs and target_roles concise and representative of the likely audience.
    - decision_questions: 3–6 sharp questions the team must decide.
    - assumptions: 3–6 current beliefs to test.
    - unknowns: 3–6 gaps that would change decisions.
    - custom_instructions: short guidance for downstream AI (tone, biases to avoid, focus).
    - Never include PII. Do not invent company names.

    INPUTS:
    - template_key: {{ template_key }}
    - project_name: {{ project_name }}
    - signup_data (JSON string):
    {{ signup_data }}

    OUTPUT FORMAT:
    {{ ctx.output_format }}
  "#
}
