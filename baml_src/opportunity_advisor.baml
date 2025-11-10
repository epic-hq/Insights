// AI Advisor for Opportunity Progression
// Analyzes opportunity context and provides actionable recommendations

class DealAdvisorRecommendation {
  status_assessment string @description("One-line assessment of current deal status and momentum")
  recommendations string[] @description("2-3 specific, actionable recommendations for moving the deal forward. Each should be concrete and time-bound.")
  risks string[] @description("1-2 key risks or blockers that could derail the deal")
  confidence string @description("Confidence level: high, medium, or low")
}

function AnalyzeOpportunity(
  opportunity_title: string,
  stage: string?,
  amount: string?,
  close_date: string?,
  product_description: string?,
  notes: string?,
  stakeholders: string, // JSON string of stakeholder data
  next_steps: string, // JSON string of next steps
  linked_interviews: string, // JSON string of interview titles and dates
) -> DealAdvisorRecommendation {
  client CustomGPT4o
  prompt #"
    You are an expert sales strategist analyzing an opportunity to provide actionable guidance.

    OPPORTUNITY CONTEXT:
    - Title: {{ opportunity_title }}
    {% if stage %}- Stage: {{ stage }}{% endif %}
    {% if amount %}- Deal Value: ${{ amount }}{% endif %}
    {% if close_date %}- Expected Close: {{ close_date }}{% endif %}
    {% if product_description %}- Product: {{ product_description }}{% endif %}
    {% if notes %}- Notes: {{ notes }}{% endif %}

    STAKEHOLDER MATRIX:
    {{ stakeholders }}

    NEXT STEPS:
    {{ next_steps }}

    {% if linked_interviews %}
    RECENT INTERVIEWS:
    {{ linked_interviews }}
    {% endif %}

    YOUR TASK:
    Analyze this opportunity and provide strategic guidance on how to advance it toward close.

    Focus on:
    1. STAKEHOLDER COVERAGE: Are we engaging the right people? Do we have access to decision makers?
    2. MOMENTUM: Are next steps clear, owned, and time-bound? Is there forward progress?
    3. QUALIFICATION: Is this a real opportunity? Do we understand their buying process?
    4. RISKS: What could prevent this from closing? What's missing?

    CRITICAL REQUIREMENTS:
    - Status assessment should be ONE sentence that captures the current state and momentum
    - Recommendations should be 2-3 SPECIFIC, ACTIONABLE items with clear next steps
    - Each recommendation should indicate WHO should do WHAT by WHEN (or suggest timing)
    - Risks should be 1-2 concrete blockers or red flags, not generic concerns
    - Be direct and prescriptive - this is for the sales team to take action on
    - Don't hedge or be vague - commit to a perspective based on the data

    EXAMPLES OF GOOD RECOMMENDATIONS:
    - "Schedule a technical deep-dive with Engineering VP within 2 weeks to validate feasibility"
    - "Request introduction to CFO by June 15th to discuss budget approval process"
    - "Send ROI analysis to Champion by EOW to arm them for internal advocacy"

    EXAMPLES OF BAD RECOMMENDATIONS:
    - "Continue building relationships" (too vague)
    - "Stay in touch" (no action or timing)
    - "Be patient" (not actionable)

    Return a structured response with:
    - status_assessment: one clear sentence
    - recommendations: array of 2-3 specific actions
    - risks: array of 1-2 concrete blockers
    - confidence: "high", "medium", or "low" based on data quality and deal momentum

    {{ ctx.output_format }}
  "#
}
