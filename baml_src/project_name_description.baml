// Generate a concise project name and a two-sentence description

class ProjectNameDescription {
  name string @description("3–5 word, concise project name without company names or PII")
  description string @description("Exactly 2 sentences summarizing goal, audience, and focus")
}

function GenerateProjectNameDescription(
  signup_data: string
) -> ProjectNameDescription {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    You are a product research strategist. Create a crisp project name and a short description
    from messy signup inputs.

    RULES:
    - Name: 3–5 words. Title case. Avoid vague buzzwords.
    - Description: Exactly 2 sentences. First: the goal and who it's for.
      Second: the focus/constraints (e.g., channels or artifacts like recordings/notes).
    - Prefer clarity over flair. Do not invent details. If info is missing, keep it generic.

    INPUT:
    signup_data (JSON):
    {{ signup_data }}

    OUTPUT FORMAT:
    {{ ctx.output_format }}
  "#
}
