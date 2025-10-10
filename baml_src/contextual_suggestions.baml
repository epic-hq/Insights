// Enhanced contextual suggestions for project setup and interview questions
// Provides real-time suggestions based on project context and user input
// Supports both project goals setup and interview question generation

class ContextualSuggestions {
  decision_questions string[] @description("Contextual decision that the user needs to make in order to best achieve their goal. ")
  assumptions string[] @description("Relevant assumptions")
  unknowns string[] @description("Key research questions/unknowns and what must be learned to help make a decision.")
  organizations string[] @description("Target organization types")
  roles string[] @description("Target user roles")
  interview_questions string[] @description("Interview questions for specific categories")
}

function GenerateContextualSuggestions(
  research_goal: string,
  current_input: string,
  suggestion_type: string, // "decision_questions", "assumptions", "unknowns", "organizations", "roles", "interview_questions"
  existing_items: string[],
  rejected_items: string[],
  project_context: string,
  custom_instructions: string,
  response_count: int,
  question_category: string? // For interview questions: "context", "pain", "workflow", etc.
) -> string[] {
  client CustomGPT4oMini
  prompt #"
    You are an expert UX researcher helping someone set up their research project and create interview questions.
    Generate {{ response_count }} highly relevant, contextual suggestions for the {{ suggestion_type }} field.

    PROJECT CONTEXT:
    - Research Goal: {{ research_goal }}
    - Current Input Being Typed: "{{ current_input }}"
    - Exclude (already added or previously shown): {{ existing_items }}
    - Rejected Items (avoid similar suggestions): {{ rejected_items }}
    - Additional Context: {{ project_context }}
    {% if custom_instructions %}- Custom Instructions: {{ custom_instructions }}{% endif %}
    {% if question_category %}- Question Category: {{ question_category }}{% endif %}

    CRITICAL REQUIREMENTS:
    - Build upon the research goal and ESPECIALLY the current input ("{{ current_input }}") as the primary direction
    - The current input should heavily influence the suggestions - expand on its theme and direction
    - Avoid generating any suggestions similar to those in the exclude list: {{ existing_items }}
    - Avoid generating suggestions similar to rejected items: {{ rejected_items }}
    - Make suggestions specific to the research domain mentioned in the goal
    - If current input exists, treat it as the primary context and build complementary suggestions
    {% if custom_instructions %}- Follow the custom instructions: {{ custom_instructions }}{% endif %}

    GENERATE SUGGESTIONS FOR: {{ suggestion_type }}

    {% if suggestion_type == "decision_questions" %}
   Generate specific, actionable decisions that the user could make to advance their business goal. Each decision should:
		- Directly influence product, marketing, or customer strategy
		- Be informed by customer behavior or insights
		- Lead to measurable outcomes that can validate success
		- Reduce uncertainty about what to build, whom to target, or how to position the product

    Format examples:
		- "Prioritize building automated cash-flow projections over manual expense tracking"
		- "Focus on milestone-based progress tracking instead of daily streaks"
		- "Gate collaboration tools behind premium plans instead of storage limits"
		- "Launch a loyalty program rewarding clients for re-booking the same freelancer"
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
    Generate research questions that are critical unknowns that create uncertainty in decision-making. Focus on:
    - Knowledge gaps that could dramatically change your strategy if filled
		- Customer context, goals, friction and pain points that could influence the user's decision
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

    {% if suggestion_type == "interview_questions" %}
    Generate specific, well-crafted interview questions{% if question_category %} for the {{ question_category }} category{% endif %}. Focus on:
    - Open-ended questions that encourage detailed responses
    - Questions that align with the research goal and current input direction
    - Questions that would provide actionable insights
    - Questions appropriate for the specified category context
    {% if question_category == "context" %}- Background and situational questions{% endif %}
    {% if question_category == "pain" %}- Questions about problems, frustrations, and challenges{% endif %}
    {% if question_category == "workflow" %}- Questions about processes, behaviors, and current methods{% endif %}
    {% if question_category == "goals" %}- Questions about objectives, desired outcomes, and motivations{% endif %}
    {% if question_category == "constraints" %}- Questions about limitations, barriers, and restrictions{% endif %}
    {% if question_category == "willingness" %}- Questions about pricing, value perception, and purchase decisions{% endif %}
    {% if question_category == "demographics" %}- Questions about background, role, and organizational context{% endif %}

    Format examples:
    - "Can you walk me through how you currently [process/task]?"
    - "What's the biggest challenge you face when [context]?"
    - "Tell me about a time when [situation] didn't go as planned."
    - "How do you decide whether to [decision/action]?"
    {% endif %}

    REQUIREMENTS:
    - Generate exactly {{ response_count }} suggestions
    - Each suggestion should be 4-25 words (interview questions can be slightly longer)
    - Avoid duplicating any in exclude list: {{ existing_items }}
    - Avoid suggestions similar to rejected items: {{ rejected_items }}
    - Be specific and actionable, not generic
    - Directly relate to the research goal and current input context
    - Use clear, professional language that a researcher would understand
    - PRIORITIZE building upon the current input ("{{ current_input }}") as the main direction
    {% if custom_instructions %}- Follow custom instructions: {{ custom_instructions }}{% endif %}

    Return only a JSON array of exactly {{ response_count }} strings, like: ["suggestion 1", "suggestion 2", "suggestion 3"]
  "#
}
