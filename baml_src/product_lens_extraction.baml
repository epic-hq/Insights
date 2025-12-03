// Product Lens Extraction (JTBD + Feature Discovery)
//
// Extracts Jobs-to-be-Done, feature requests, product gaps, and competitive insights

// ============================================================================
// Core JTBD Classes
// ============================================================================

class JobToBeDone {
  job_description string @description("The core 'job' the user is trying to accomplish")
  situation string? @description("The situation or context when this job arises")
  desired_outcome string @description("What success looks like for this job")
  current_solution string? @description("How they currently try to accomplish this job")
  frustrations string[] @description("What frustrates them about current solutions")
  importance string @description("Importance level: 'critical', 'high', 'medium', or 'low'")
  satisfaction string @description("Current satisfaction: 'very_unsatisfied', 'unsatisfied', 'neutral', 'satisfied'")
  frequency string @description("How often: 'daily', 'weekly', 'monthly', 'occasionally', 'rarely'")
  evidence_ids string[] @description("IDs of evidence supporting this JTBD")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
}

class FeatureRequest {
  feature_name string @description("Name or short description of the requested feature")
  description string @description("Detailed description of what the feature should do")
  use_case string @description("The specific use case or problem this solves")
  priority string @description("User-indicated priority: 'must_have', 'should_have', 'nice_to_have'")
  related_job_description string? @description("Which job-to-be-done this feature helps with")
  competitive_alternative string? @description("Existing product/feature they compare this to")
  evidence_ids string[] @description("IDs of evidence supporting this request")
  confidence float @description("Confidence in this assessment (0.0 to 1.0)")
}

class ProductGap {
  gap_description string @description("Description of the missing capability or unmet need")
  impact string @description("Impact of this gap: 'blocking', 'significant', 'moderate', 'minor'")
  affected_workflow string? @description("Which workflow or process is affected")
  workaround string? @description("Current workaround if any")
  competitive_advantage string? @description("Competitor that has solved this")
  evidence_ids string[] @description("IDs of evidence supporting this gap")
}

class CompetitiveInsight {
  competitor_name string @description("Name of competitive product mentioned")
  context string @description("Context in which competitor was mentioned")
  comparison_type string @description("Type: 'positive' (they like it), 'negative' (they don't), 'neutral' (just mentioned)")
  specific_features string[] @description("Specific features mentioned")
  switching_consideration bool @description("Are they considering switching to/from this competitor?")
  evidence_ids string[] @description("IDs of evidence supporting this insight")
}

class FeaturePrioritization {
  feature_theme string @description("High-level feature theme or category")
  user_segments string[] @description("Which user segments care about this")
  evidence_count int @description("Number of evidence items supporting this")
  urgency_score float @description("Urgency score based on frequency and importance (0.0 to 1.0)")
  recommended_action string @description("Recommended next step for this feature")
}

// ============================================================================
// Main Output Schema
// ============================================================================

class ProductLensExtraction {
  jobs JobToBeDone[] @description("Jobs-to-be-Done identified in conversation")
  feature_requests FeatureRequest[] @description("Explicit feature requests")
  product_gaps ProductGap[] @description("Identified gaps in current product")
  competitive_insights CompetitiveInsight[] @description("Mentions of competitors or alternatives")
  feature_priorities FeaturePrioritization[] @description("Prioritized feature themes")
  key_insights string[] @description("Top 3-5 strategic product insights")
}

// ============================================================================
// Main Extraction Function
// ============================================================================

function ExtractProductLens(
  evidence_json: string,
  interview_context: string
) -> ProductLensExtraction {
  client CustomGPT4o

  prompt #"
    You are an expert product manager analyzing customer interview evidence to identify Jobs-to-be-Done (JTBD), feature requests, and product gaps.

    ## Interview Context
    {{ interview_context }}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions

    Analyze the evidence and extract comprehensive product insights:

    ### Jobs-to-be-Done (JTBD)
    - Identify the core "jobs" users are trying to accomplish
    - Look for statements about goals, objectives, tasks they need to complete
    - Capture the situation/context when this job arises
    - Note their desired outcome and how they currently try to solve it
    - Rate importance, satisfaction, and frequency based on evidence
    - JTBD should be outcome-focused, not solution-focused

    ### Feature Requests
    - Explicit asks for specific features or capabilities
    - "I wish it could...", "It would be great if...", "I need to be able to..."
    - Capture the use case and why they need it
    - Infer priority from their language (must have vs nice to have)
    - Note any competitive alternatives they mention

    ### Product Gaps
    - Unmet needs or missing capabilities
    - Workflows that are broken or inefficient
    - Pain points that indicate missing features
    - Note the impact and any workarounds they're using

    ### Competitive Insights
    - Mentions of other products, tools, or solutions
    - What they like/dislike about alternatives
    - Features they wish you had from competitors
    - Switching considerations

    ### Feature Prioritization
    - Group related feature requests into themes
    - Calculate urgency based on frequency and importance
    - Provide actionable recommendations

    ### Key Insights
    - 3-5 strategic product insights for the product team
    - Focus on high-impact opportunities
    - Connect insights to business value

    Be specific and evidence-based. Always link back to evidence IDs.

    {{ ctx.output_format }}
  "#
}
