// Generate a lens template from natural language description
// Used for custom lens creation

class GeneratedLensField {
  field_key string @description("Lowercase snake_case identifier, e.g. 'pain_points', 'budget_range'")
  field_name string @description("Human-readable field label, e.g. 'Pain Points', 'Budget Range'")
  field_type "text" | "text_array" | "numeric" | "date" | "boolean" @description("Data type for this field")
  description string? @description("Brief explanation of what this field captures")
}

class GeneratedLensSection {
  section_key string @description("Lowercase snake_case identifier, e.g. 'problem_space', 'qualification'")
  section_name string @description("Human-readable section title, e.g. 'Problem Space', 'Qualification'")
  description string? @description("Brief explanation of what this section captures")
  fields GeneratedLensField[] @description("2-6 fields in this section")
}

class GeneratedLensTemplate {
  template_name string @description("Short, descriptive name for the lens (2-5 words), e.g. 'Competitive Analysis', 'HR Interview'")
  summary string @description("One sentence describing what this lens extracts")
  primary_objective string @description("The main goal of applying this lens")
  sections GeneratedLensSection[] @description("2-5 sections grouping related fields")
  entities string[] @description("Entity types to extract. Valid values: 'stakeholders', 'next_steps', 'objections'. Use empty array if none apply.")
  recommendations_enabled bool @description("Whether to generate actionable recommendations")
}

function GenerateLensTemplate(
  user_description: string,
  example_context: string?
) -> GeneratedLensTemplate {
  client CustomGPT4o
  prompt #"
    You are an expert at designing conversation analysis frameworks.
    Create a structured lens template based on the user's description.

    ## User's Description
    {{ user_description }}

    {% if example_context %}
    ## Additional Context About Their Use Case
    {{ example_context }}
    {% endif %}

    ## Guidelines

    1. **Naming**: Create a short, clear template_name (2-5 words). Use Title Case.

    2. **Sections**: Design 2-5 logical sections that group related information.
       - Each section should have a clear purpose
       - Use snake_case for section_key
       - Use Title Case for section_name

    3. **Fields**: Each section should have 2-6 fields.
       - Use appropriate field types:
         - `text`: Single value or summary (budget amount, main pain point, timeline)
         - `text_array`: Multiple items (features requested, competitors mentioned, objections raised)
         - `numeric`: Numbers or scores (satisfaction rating 1-10, team size, budget amount)
         - `date`: Dates (deadline, next meeting, contract renewal)
         - `boolean`: Yes/no flags (has budget approved, is decision maker)
       - Use snake_case for field_key
       - Use Title Case for field_name

    4. **Entities**: Only include entity types if genuinely relevant:
       - `stakeholders`: Include if the lens should track people, their roles, and influence
       - `next_steps`: Include if action items and follow-ups are important
       - `objections`: Include if concerns, blockers, or risks should be tracked
       - Use empty array [] if none of these apply

    5. **Recommendations**: Enable if actionable insights would be valuable (usually true for sales, research, product lenses)

    ## Examples of Good Section Design

    For a **Sales Discovery** lens:
    - sections: qualification, pain_points, current_state, decision_process
    - entities: ["stakeholders", "next_steps", "objections"]

    For a **User Research** lens:
    - sections: user_context, pain_points, current_workflow, desired_outcomes
    - entities: ["stakeholders"]

    For a **Competitive Intel** lens:
    - sections: competitor_mentions, feature_comparisons, switching_factors, pricing_intel
    - entities: []

    For an **HR Interview** lens:
    - sections: candidate_background, role_fit, culture_fit, concerns
    - entities: ["next_steps"]

    Return a well-structured template that will extract meaningful, actionable insights.

    {{ ctx.output_format }}
  "#
}
