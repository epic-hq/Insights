// Research Lens Extraction (Usability + Validation)
//
// Extracts usability findings, hypothesis validation, user journey insights, and research learnings

// ============================================================================
// Core Research Classes
// ============================================================================

class UsabilityFinding {
  finding_description string @description("Description of the usability issue or observation")
  severity string @description("Severity: 'critical', 'major', 'minor', 'enhancement'")
  affected_feature string? @description("Specific feature or workflow affected")
  user_behavior string @description("What the user did or tried to do")
  user_expectation string @description("What the user expected to happen")
  actual_result string @description("What actually happened")
  suggested_fix string? @description("Potential solution or recommendation")
  evidence_ids string[] @description("IDs of evidence supporting this finding")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
}

class HypothesisValidation {
  hypothesis_statement string @description("The hypothesis being tested or discussed")
  validation_result string @description("Result: 'validated', 'invalidated', 'partially_validated', 'inconclusive'")
  supporting_evidence string[] @description("Evidence that supports or refutes the hypothesis")
  confidence_level string @description("Confidence: 'high', 'medium', 'low'")
  implications string @description("What this means for the product or research direction")
  evidence_ids string[] @description("IDs of evidence supporting this validation")
}

class UserJourneyInsight {
  journey_stage string @description("Stage: 'awareness', 'consideration', 'purchase', 'onboarding', 'usage', 'retention', 'expansion'")
  insight_description string @description("Key insight about this journey stage")
  pain_points string[] @description("Pain points encountered at this stage")
  moments_of_delight string[] @description("Positive experiences at this stage")
  opportunity_area string? @description("Opportunity to improve this stage")
  evidence_ids string[] @description("IDs of evidence supporting this insight")
}

class BehaviorPattern {
  pattern_description string @description("Description of the observed behavior pattern")
  frequency string @description("How common: 'very_common', 'common', 'occasional', 'rare'")
  user_segment string? @description("Which user segment exhibits this pattern")
  triggers string[] @description("What triggers this behavior")
  implications string @description("What this pattern means for product design")
  evidence_ids string[] @description("IDs of evidence supporting this pattern")
}

class ResearchQuestionInsight {
  question string @description("The research question raised")
  status string @description("Status: 'answered', 'partially_answered', 'unanswered'")
  answer string? @description("The answer if found")
  follow_up_needed string? @description("What follow-up research is needed")
  evidence_ids string[] @description("IDs of evidence related to this question")
}

class MentalModel {
  model_description string @description("Description of user's mental model or understanding")
  matches_product bool @description("Does their mental model match how the product actually works?")
  gap_description string? @description("If not, what's the gap between their model and reality?")
  design_recommendation string? @description("How to align product with user mental model")
  evidence_ids string[] @description("IDs of evidence supporting this mental model")
}

// ============================================================================
// Main Output Schema
// ============================================================================

class ResearchLensExtraction {
  usability_findings UsabilityFinding[] @description("Usability issues and observations")
  hypothesis_validations HypothesisValidation[] @description("Hypotheses tested or discussed")
  journey_insights UserJourneyInsight[] @description("Insights across the user journey")
  behavior_patterns BehaviorPattern[] @description("Observed behavioral patterns")
  research_questions ResearchQuestionInsight[] @description("Research questions raised or answered")
  mental_models MentalModel[] @description("User mental models uncovered")
  key_learnings string[] @description("Top 3-5 key research learnings")
  recommended_next_research string[] @description("Recommended follow-up research")
}

// ============================================================================
// Main Extraction Function
// ============================================================================

function ExtractResearchLens(
  evidence_json: string,
  interview_context: string
) -> ResearchLensExtraction {
  client CustomGPT4o

  prompt #"
    You are an expert UX researcher analyzing interview evidence to extract usability findings, validate hypotheses, and understand user behavior.

    ## Interview Context
    {{ interview_context }}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions

    Analyze the evidence and extract comprehensive research insights:

    ### Usability Findings
    - Identify where users struggled, got confused, or had friction
    - Note the severity based on impact on user experience
    - Capture what they tried to do vs what happened
    - Include their expectations vs reality
    - Suggest potential fixes based on the issue

    ### Hypothesis Validation
    - Look for evidence that validates or invalidates assumptions
    - "I thought users would...", "We assumed...", "We believed..."
    - Assess confidence level based on strength of evidence
    - Note implications for product decisions

    ### User Journey Insights
    - Map insights to specific stages of the user journey
    - Identify pain points and moments of delight at each stage
    - Look for opportunities to improve the journey
    - Focus on transitions between stages

    ### Behavior Patterns
    - Recurring behaviors or habits mentioned
    - How frequently these patterns occur
    - What triggers these behaviors
    - Implications for product design and features

    ### Research Questions
    - Questions that were answered during the interview
    - New questions that emerged
    - Gaps in understanding that need follow-up research

    ### Mental Models
    - How users think about or understand the product/domain
    - Metaphors or analogies they use
    - Mismatches between their model and actual product behavior
    - Recommendations to align product with their mental model

    ### Key Learnings
    - 3-5 most important research insights
    - Focus on actionable findings
    - Connect to user needs and product decisions

    ### Recommended Next Research
    - Follow-up questions to explore
    - Hypotheses to test in future research
    - User segments or scenarios to study further

    Be specific and evidence-based. Always link back to evidence IDs.

    {{ ctx.output_format }}
  "#
}
