// Auto-Insights BAML Schema and Function
// Generates executive-level insights and recommendations from user research data

class ActionButton {
  label string @description("Button text for the action")
  action_type string @description("Type of action: create_opportunity | prioritize_insight | schedule_research | create_persona | tag_insights")
  parameters string @description("Action-specific parameters as JSON string")
  priority string @description("Action priority: High | Medium | Low")
}

class ExecutiveInsight {
  title string @description("Executive-level insight title (5-8 words)")
  insight string @description("Strategic insight or recommendation (2-3 sentences without the fluff)")
  evidence string[] @description("Supporting evidence from user research (quotes, data points)")
  business_impact string @description("Business impact description and potential value")
  impact_level string @description("Impact level: High | Medium | Low")
  confidence_level string @description("Confidence in this insight: High | Medium | Low")
  personas_affected string[] @description("Which personas this insight affects most")
  recommended_actions ActionButton[] @description("Actionable next steps with buttons")
  category string @description("Insight category: Revenue | Product | User Experience | Market | Risk")
}

class OpportunityRecommendation {
  title string @description("Opportunity title")
  description string @description("Detailed opportunity description")
  revenue_potential string @description("Revenue potential: High | Medium | Low")
  effort_estimate string @description("Implementation effort: High | Medium | Low")
  target_personas string[] @description("Primary personas who would benefit")
  supporting_insights string[] @description("Key insights that support this opportunity")
  competitive_advantage string @description("How this creates competitive advantage")
  recommended_actions ActionButton[] @description("Next steps to pursue this opportunity")
}

class PersonaAnalysis {
  persona_name string @description("Persona name")
  key_pain_points string[] @description("Top 3 pain points for this persona")
  unmet_needs string[] @description("Unmet needs and desired outcomes")
  revenue_potential string @description("Revenue potential from this persona: High | Medium | Low")
  willingness_to_pay string @description("Likelihood to pay for solutions: High | Medium | Low")
  recommended_solutions string[] @description("Specific solutions this persona would value")
  competitive_threats string[] @description("How competitors might target this persona")
}

class AutoInsightsResponse {
  executive_summary string @description("High-level summary of key findings (3-4 sentences)")
  top_opportunities OpportunityRecommendation[] @description("Top 3-5 revenue-generating opportunities")
  critical_insights ExecutiveInsight[] @description("Most important strategic insights")
  persona_analysis PersonaAnalysis[] @description("Analysis of each key persona")
  competitive_considerations string[] @description("Key competitive pressures and threats")
  immediate_actions ActionButton[] @description("Top 3 immediate actions to take")
  strategic_recommendations string[] @description("Long-term strategic recommendations")
}

function GenerateAutoInsights(
  research_data: string,
  competitive_context: string,
  business_goals: string
) -> AutoInsightsResponse {
  client "CustomGPT4o"
  prompt #"
    You are a senior product strategist and user research expert analyzing comprehensive user research data to generate executive-level insights and recommendations.

    ## Research Data
    {{ research_data }}

    ## Competitive Context
    {{ competitive_context }}

    ## Business Goals
    {{ business_goals }}

    ## Your Task
    Analyze this data to answer key executive questions:

    1. **What are the top revenue-generating opportunities?**
       - Identify opportunities with highest revenue potential
       - Consider market size, willingness to pay, and competitive advantage
       - Prioritize based on effort vs. impact

    2. **What are the most critical pain points to solve?**
       - Focus on high-impact, high-frequency pain points
       - Consider emotional intensity and business impact
       - Identify pain points that competitors aren't addressing

    3. **Which personas offer the best revenue potential?**
       - Analyze willingness to pay by persona
       - Consider market size and accessibility
       - Identify underserved segments

    4. **What changes would benefit different personas most?**
       - Persona-specific recommendations
       - Consider journey stage and context
       - Prioritize changes with broad appeal

    5. **Given competitive pressures, what are the most profitable opportunities?**
       - Consider competitive landscape
       - Identify differentiation opportunities
       - Focus on defensible advantages

    ## Analysis Guidelines
    - **Be Strategic**: Focus on business impact, not just user satisfaction
    - **Be Specific**: Provide concrete, actionable recommendations
    - **Be Evidence-Based**: Ground insights in actual user research data
    - **Be Prioritized**: Rank opportunities by revenue potential and feasibility
    - **Be Competitive**: Consider how to win against competitors

    ## Action Button Guidelines
    Create actionable buttons with these types:
    - `create_opportunity`: Creates new opportunity with title and description
    - `prioritize_insight`: Marks insight as high priority for follow-up
    - `schedule_research`: Schedules additional research on specific topic
    - `create_persona`: Creates new persona based on findings
    - `tag_insights`: Tags related insights for better organization

    Parameters should include relevant IDs, titles, descriptions, and metadata.

    ## Output Requirements
    - **Executive Summary**: 3-4 sentences highlighting the most important findings
    - **Top Opportunities**: 3-5 opportunities ranked by revenue potential
    - **Critical Insights**: 5-7 strategic insights with evidence and actions
    - **Persona Analysis**: Detailed analysis of each key persona
    - **Competitive Considerations**: Key threats and competitive responses needed
    - **Immediate Actions**: Top 3 actions to take in the next 30 days
    - **Strategic Recommendations**: Long-term strategic direction

    Focus on insights that drive business value and competitive advantage.

    {{ ctx.output_format }}
  "#
}

// Test function for development
test GenerateAutoInsights_Sample {
  functions [GenerateAutoInsights]
  args {
    research_data #"
      # Sample Research Data
      ## Overview
      - Total Insights: 45
      - Total Interviews: 12
      - Total People: 8
      - Date Range: 2024-01-15 to 2024-03-20

      ## Top Insights
      ### Time Management Struggles (Category: User Experience)
      - Pain: Users spend 2-3 hours daily on manual planning
      - Desired Outcome: Automated planning that saves time
      - Evidence: "I waste so much time just figuring out what to do next" (Interview #3)
      - Impact: 5/5, Novelty: 3/5
      - Personas: Busy Professional, Student

      ### Lack of Progress Visibility (Category: Product)
      - Pain: Users can't see long-term progress toward goals
      - Desired Outcome: Clear progress tracking and milestones
      - Evidence: "I never know if I'm actually getting closer to my goals" (Interview #7)
      - Impact: 4/5, Novelty: 4/5
      - Personas: Goal-Oriented Achiever

      ## Personas
      ### Busy Professional (60% of users)
      - Top Pain Points: Time management, Context switching, Overwhelm
      - Desired Outcomes: Efficiency, Focus, Work-life balance

      ### Student (25% of users)
      - Top Pain Points: Procrastination, Study planning, Motivation
      - Desired Outcomes: Better grades, Reduced stress, Time for social life
    "#
    competitive_context #"
      Key competitors include Notion, Todoist, and Asana. Most focus on task management but lack intelligent planning and progress visualization.
    "#
    business_goals #"
      - Achieve $1M ARR within 18 months
      - Build defensible AI-powered planning features
      - Target productivity-focused professionals and students
    "#
  }
}
