// Goal-Oriented Lens Extraction
//
// Answers specific research goals, decision questions, and unknowns defined in project setup

// ============================================================================
// Core Goal Classes
// ============================================================================

class GoalAnswer {
  goal_statement string @description("The original research goal or question")
  answer_summary string @description("Direct answer to this goal/question")
  confidence string @description("Confidence: 'high', 'medium', 'low', 'inconclusive'")
  supporting_findings string[] @description("Key findings that support this answer")
  counterpoints string[] @description("Any evidence that contradicts or qualifies the answer")
  evidence_ids string[] @description("IDs of evidence supporting this answer")
}

class DecisionInsight {
  decision_question string @description("The decision question from project setup")
  recommendation string @description("Recommended decision based on interview evidence")
  rationale string @description("Why this recommendation based on evidence")
  risks string[] @description("Risks or caveats to consider")
  confidence string @description("Confidence: 'high', 'medium', 'low'")
  evidence_ids string[] @description("IDs of evidence supporting this recommendation")
}

class UnknownResolution {
  unknown_statement string @description("The unknown or uncertainty from project setup")
  status string @description("Status: 'resolved', 'partially_resolved', 'still_unknown'")
  findings string? @description("What we learned about this unknown")
  remaining_uncertainty string? @description("What's still unclear")
  suggested_follow_up string? @description("How to further explore this")
  evidence_ids string[] @description("IDs of evidence related to this unknown")
}

class TargetFitAssessment {
  criterion_type string @description("Type: 'org' for organization, 'role' for role/title")
  criterion_value string @description("The specific org type or role from target criteria")
  fit_assessment string @description("Fit: 'strong_fit', 'moderate_fit', 'weak_fit', 'not_fit'")
  reasoning string @description("Why this is/isn't a good fit based on interview")
  signals string[] @description("Specific signals that indicate fit or lack thereof")
  evidence_ids string[] @description("IDs of evidence supporting this assessment")
}

class ResearchLearning {
  learning_statement string @description("What we learned from this interview")
  relevance_to_goals string @description("How this relates to research goals")
  actionability string @description("What action this suggests")
  priority string @description("Priority: 'high', 'medium', 'low'")
  evidence_ids string[] @description("IDs of evidence supporting this learning")
}

// ============================================================================
// Main Output Schema
// ============================================================================

class GoalLensExtraction {
  goal_answers GoalAnswer[] @description("Answers to research goals")
  decision_insights DecisionInsight[] @description("Insights for decision questions")
  unknown_resolutions UnknownResolution[] @description("Resolution of unknowns/uncertainties")
  target_fit TargetFitAssessment[] @description("Assessment of fit with target orgs/roles")
  research_learnings ResearchLearning[] @description("Key learnings relevant to goals")
  goal_completion_score float @description("Overall score: how well did this interview address goals? (0.0 to 1.0)")
  recommended_follow_ups string[] @description("Follow-up questions or interviews recommended")
}

// ============================================================================
// Main Extraction Function
// ============================================================================

function ExtractGoalLens(
  evidence_json: string,
  interview_context: string,
  project_goals: string,
  decision_questions: string,
  unknowns: string,
  target_orgs: string,
  target_roles: string
) -> GoalLensExtraction {
  client CustomGPT4o

  prompt #"
    You are analyzing interview evidence against specific research goals and decision criteria defined for this project.

    ## Interview Context
    {{ interview_context }}

    ## Project Research Goals
    {{ project_goals }}

    ## Decision Questions to Answer
    {{ decision_questions }}

    ## Unknowns/Uncertainties to Resolve
    {{ unknowns }}

    ## Target Organization Types
    {{ target_orgs }}

    ## Target Roles/Titles
    {{ target_roles }}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions

    Your task is to directly answer the research goals and decision questions based on the interview evidence.

    ### Goal Answers
    - For each research goal, provide a direct answer
    - Summarize key findings that address this goal
    - Note confidence level based on strength of evidence
    - Include any counterpoints or qualifications

    ### Decision Insights
    - For each decision question, provide a recommendation
    - Explain the rationale based on interview evidence
    - Note risks or caveats
    - Assess confidence in the recommendation

    ### Unknown Resolutions
    - For each unknown/uncertainty, assess if it was resolved
    - What did we learn?
    - What's still unclear?
    - Suggest how to further explore unresolved unknowns

    ### Target Fit Assessment
    - Assess how well the interviewee fits target org/role criteria
    - Note specific signals from the interview
    - Consider: do they exhibit the characteristics we're looking for?
    - This helps determine if we should interview more people like them

    ### Research Learnings
    - Key learnings that are relevant to research goals
    - Prioritize learnings by actionability
    - Connect learnings back to goals

    ### Goal Completion Score
    - Calculate how well this interview addressed the research goals
    - 1.0 = fully addressed all goals, 0.0 = addressed none
    - Consider coverage and depth

    ### Recommended Follow-Ups
    - What follow-up questions emerged?
    - What should we explore in future interviews?
    - Who else should we talk to?

    Be specific and evidence-based. Always link back to evidence IDs.

    {{ ctx.output_format }}
  "#
}
