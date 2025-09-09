// Contextual suggestions for project setup
// Provides real-time suggestions based on project context and user input

class ContextualSuggestions {
  decision_questions string[] @description("Contextual decision questions")
  assumptions string[] @description("Relevant assumptions")
  unknowns string[] @description("Key unknowns")
  organizations string[] @description("Target organization types")
  roles string[] @description("Target user roles")
}

function GenerateContextualSuggestions(
  research_goal: string,
  current_input: string,
  suggestion_type: string, // "decision_questions", "assumptions", "unknowns", "organizations", "roles"
  existing_items: string[],
  project_context: string
) -> string[] {
  client CustomGPT4oMini
  prompt #"
    You are an expert UX researcher helping someone set up their research project.
    Generate 3-4 highly relevant, contextual suggestions for the {{ suggestion_type }} field.

    PROJECT CONTEXT:
    - Research Goal: {{ research_goal }}
    - Current Input Being Typed: "{{ current_input }}"
    - Already Added Items: {{ existing_items }}
    - Additional Context: {{ project_context }}

    IMPORTANT: 
    - Build upon the research goal and current input context
    - Avoid duplicating existing items: {{ existing_items }}
    - Make suggestions specific to the research domain mentioned in the goal
    - If current input exists, consider it as a starting point or theme to expand on

    GENERATE SUGGESTIONS FOR: {{ suggestion_type }}

    {% if suggestion_type == "decision_questions" %}
    Generate specific, actionable research questions that would have clear business impact. Focus on:
    - Questions that would directly influence business decisions or strategy
    - Customer behavior insights that could change how you build or market
    - Specific outcomes that could be measured and validated
    - Questions that, once answered, would reduce uncertainty about what to build next
    
    Format examples: 
    - "What specific job-to-be-done causes customers to switch from competitors?"
    - "Which onboarding steps predict long-term retention?"
    - "What pricing threshold makes customers choose premium over basic?"
    {% endif %}

    {% if suggestion_type == "assumptions" %}
    Generate testable assumptions that are core beliefs driving this research. Focus on:
    - Specific customer behavior patterns you believe to be true
    - Market conditions or competitive dynamics you're assuming
    - Product/feature beliefs that influence your roadmap
    - Business model assumptions that affect strategy
    
    Make them concrete and testable. Format examples:
    - "Customers value outcome X more than feature Y"
    - "Users abandon the product primarily due to onboarding friction"
    - "Price sensitivity decreases once customers see clear ROI"
    - "Our target market prefers self-service over human support"
    {% endif %}

    {% if suggestion_type == "unknowns" %}
    Generate critical unknowns that create uncertainty in decision-making. Focus on:
    - Knowledge gaps that could dramatically change your strategy if filled
    - Customer behavior patterns that you're unsure about
    - Market dynamics that could affect adoption or success
    - Competitive threats or advantages that remain unclear
    
    Frame as specific uncertainties. Format examples:
    - "Customer willingness to pay for premium features"
    - "Which competitor features drive the most switching"
    - "How much friction customers will tolerate before churning"
    - "Whether our value prop resonates with mid-market vs enterprise"
    {% endif %}

    {% if suggestion_type == "organizations" %}
    Generate specific organization types that would be ideal participants for this research. Focus on:
    - Company sizes, stages, and revenue ranges that match your target market
    - Industry verticals where your research goal is most relevant
    - Business models that align with what you're trying to learn
    - Market segments that face the problems you're investigating
    
    Be specific about characteristics. Format examples:
    - "Series A B2B SaaS companies (50-200 employees)"
    - "Ecommerce brands with $1M-10M annual revenue"
    - "Digital marketing agencies serving SMB clients"
    - "Healthcare startups in regulatory-heavy markets"
    {% endif %}

    {% if suggestion_type == "roles" %}
    Generate specific user roles that would provide the most valuable insights for this research. Focus on:
    - Decision makers who influence purchasing or adoption decisions
    - End users who directly experience the problems you're researching
    - Stakeholders who would be affected by potential solutions
    - Roles that span different levels (individual contributors, managers, executives)
    
    Include seniority and functional context. Format examples:
    - "VP of Product (50-500 person companies)"
    - "Customer Success Manager at SaaS companies"
    - "Marketing Operations Director"
    - "Small business owner (solo or 2-10 employees)"
    {% endif %}

    REQUIREMENTS:
    - Each suggestion should be 4-20 words (slightly longer for more context)
    - Avoid duplicating existing items: {{ existing_items }}
    - Be specific and actionable, not generic
    - Directly relate to the research goal context
    - Use clear, professional language that a researcher would understand
    - If current input exists, build upon or complement that theme

    Return only a JSON array of exactly 3-4 strings, like: ["suggestion 1", "suggestion 2", "suggestion 3"]
  "#
}