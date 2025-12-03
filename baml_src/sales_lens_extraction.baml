// Sales Lens BANT Extraction
//
// Extracts Budget, Authority, Need, Timeline (BANT) framework data from evidence.
// Also identifies stakeholder roles, next steps, and deal qualification signals.

// ============================================================================
// Core BANT Classes
// ============================================================================

class BudgetInfo {
  has_budget_discussion bool @description("Whether budget was explicitly discussed")
  amount_mentioned string? @description("Any specific amount or range mentioned (e.g., '$50K', '100-150K range')")
  budget_status string? @description("Status: 'approved', 'pending', 'not_discussed', 'insufficient', or 'flexible'")
  pricing_sensitivity string @description("Sensitivity level: 'high', 'medium', or 'low'")
  payment_terms string? @description("Payment structure if mentioned (e.g., 'annual contract', 'per seat', 'usage-based')")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
  supporting_quote string? @description("Most relevant verbatim quote about budget")
  evidence_ids string[] @description("IDs of evidence pieces that support this assessment")
}

class AuthorityInfo {
  decision_maker_identified bool @description("Whether a clear decision maker was identified")
  decision_maker_name string? @description("Name of the decision maker if known")
  decision_maker_role string? @description("Role/title of decision maker (e.g., 'VP Engineering', 'CEO')")
  approval_process string? @description("Described approval process (e.g., 'needs board approval', 'can decide independently')")
  stakeholders_involved string[] @description("Other stakeholders involved in decision")
  blockers string[] @description("Identified blockers or obstacles (e.g., 'CFO concerned about cost', 'legal review required')")
  political_dynamics string? @description("Any power dynamics or politics mentioned")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
  evidence_ids string[] @description("IDs of evidence pieces that support this assessment")
}

class NeedInfo {
  primary_pain_points string[] @description("Top 3-5 pain points or needs expressed")
  pain_severity string @description("Overall severity: 'critical', 'significant', 'moderate', or 'minor'")
  impact_on_business string? @description("How the problem impacts their business")
  current_workarounds string[] @description("Current solutions or workarounds they're using")
  must_have_features string[] @description("Features they explicitly said are must-haves")
  nice_to_have_features string[] @description("Features that are desirable but not critical")
  competing_priorities string[] @description("Other projects or initiatives competing for attention")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
  evidence_ids string[] @description("IDs of evidence pieces that support this assessment")
}

class TimelineInfo {
  urgency_level string @description("Urgency: 'immediate', 'high', 'medium', or 'low'")
  target_date string? @description("Specific date or timeframe mentioned (e.g., 'Q1 2025', 'by March', 'within 3 months')")
  deadline_type string? @description("Type of deadline: 'hard_deadline', 'soft_target', 'flexible', or 'no_deadline'")
  implementation_timeline string? @description("Expected implementation timeframe")
  external_drivers string[] @description("External factors driving timeline (e.g., 'end of fiscal year', 'product launch')")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
  evidence_ids string[] @description("IDs of evidence pieces that support this assessment")
}

class NextStepInfo {
  action_item string @description("Specific action to be taken")
  owner string? @description("Who is responsible (name or role)")
  due_date string? @description("When it should be done")
  commitment_level string @description("Level of commitment: 'firm', 'tentative', or 'vague'")
  evidence_ids string[] @description("IDs of evidence pieces that support this")
}

class StakeholderRole {
  person_name string @description("Name of the CUSTOMER stakeholder (NOT internal team members like sales reps)")
  person_role string? @description("Their job title or role at the CUSTOMER organization")
  role_type string @description("Buying role: MUST be one of: 'economic_buyer', 'decision_maker', 'influencer', 'champion', or 'blocker'. Only for customer-side people.")
  influence_level string @description("Influence level: 'high', 'medium', or 'low'")
  sentiment string @description("Their sentiment toward the solution: 'positive', 'neutral', 'negative', or 'skeptical'")
  key_concerns string[] @description("Their main concerns or objections")
  key_motivations string[] @description("What motivates them about this solution")
  evidence_ids string[] @description("IDs of evidence pieces that support this assessment")
}

class DealQualificationSignals {
  positive_signals string[] @description("Positive signals that indicate a qualified opportunity")
  warning_flags string[] @description("Warning flags or red flags to watch out for")
  overall_qualification string @description("Overall assessment: 'highly_qualified', 'qualified', 'somewhat_qualified', or 'not_qualified'")
  recommended_actions string[] @description("Recommended next actions based on qualification")
}

// ============================================================================
// Main Output Schema
// ============================================================================

class SalesLensExtraction {
  budget BudgetInfo @description("Budget information and constraints")
  authority AuthorityInfo @description("Decision-making authority and process")
  need NeedInfo @description("Customer needs and pain points")
  timeline TimelineInfo @description("Timeline and urgency information")
  next_steps NextStepInfo[] @description("Agreed-upon next steps and action items")
  stakeholders StakeholderRole[] @description("Stakeholder analysis and roles")
  deal_qualification DealQualificationSignals @description("Deal qualification assessment")
  key_insights string[] @description("Top 3-5 strategic insights for the sales team")
  risks_and_concerns string[] @description("Identified risks or concerns to address")
}

// ============================================================================
// Main Extraction Function
// ============================================================================

function ExtractSalesLensBant(
  evidence_json: string,
  interview_context: string
) -> SalesLensExtraction {
  client CustomGPT4o

  prompt #"
    You are an expert sales analyst extracting BANT (Budget, Authority, Need, Timeline) framework information from customer interview evidence.

    ## Interview Context
    {{ interview_context }}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions

    Analyze the evidence above and extract comprehensive BANT information. For each assessment:
    1. Base your analysis ONLY on the evidence provided - do not infer beyond what's stated
    2. Always include the evidence_ids that support each claim
    3. Use verbatim quotes when available for supporting_quote fields
    4. Assign confidence scores based on clarity and specificity of evidence
    5. Identify stakeholder dynamics and power structures

    ### Budget
    - Look for: pricing discussions, budget constraints, cost concerns, ROI conversations, payment terms
    - Assess sensitivity based on how much they focus on price vs value
    - Include specific amounts if mentioned, even if approximate

    ### Authority
    - Identify who has decision-making power
    - Map the approval process and stakeholders involved
    - Flag any blockers or political dynamics
    - Note if they're speaking independently or need buy-in

    ### Need
    - Extract all pain points mentioned, ranked by severity
    - Understand business impact of these problems
    - Distinguish between must-haves and nice-to-haves
    - Note current workarounds or competing solutions

    ### Timeline
    - Assess urgency level based on language used
    - Extract any specific dates or timeframes
    - Identify external drivers (fiscal year, product launches, etc.)
    - Determine if deadlines are hard requirements or soft targets

    ### Stakeholders
    - IMPORTANT: Only identify CUSTOMER-SIDE stakeholders (prospects, clients, decision makers from the customer organization)
    - EXCLUDE internal team members (sales reps, account executives, customer success, support staff, etc.) - they are NOT stakeholders
    - Example: If "DJ" is conducting the interview or representing your company, DO NOT include them as economic_buyer or decision_maker
    - Example: If "Stephen" is the prospect being interviewed, include them with appropriate customer-side role (e.g., decision_maker, influencer)
    - Map each CUSTOMER stakeholder to a buying role (economic_buyer, decision_maker, influencer, champion, blocker)
    - Assess their influence level and sentiment
    - Identify their specific concerns and motivations
    - This is CRITICAL for navigating complex B2B sales

    ### Next Steps
    - Extract specific, actionable commitments
    - Note who owns each action and when it's due
    - Assess commitment level (firm vs tentative)

    ### Deal Qualification
    - Identify positive signals (strong need, clear budget, engaged champion, etc.)
    - Flag warning signs (lack of urgency, no clear authority, vague needs, etc.)
    - Provide an overall qualification assessment
    - Recommend specific actions to advance or qualify out

    ## Output Requirements
    - Be specific and evidence-based
    - Always link back to evidence IDs
    - Use confidence scores to indicate certainty
    - Provide actionable insights for the sales team

    {{ ctx.output_format }}
  "#
}
