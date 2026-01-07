// Ask Link Response Analysis
// Generates insights and summaries from survey/Ask link responses

class ResponseTheme {
  theme string @description("Key theme identified across responses (3-5 words)")
  description string @description("Brief description of the theme")
  frequency int @description("Number of responses mentioning this theme")
  sentiment string @description("Overall sentiment: Positive | Neutral | Negative | Mixed")
  example_quotes string[] @description("2-3 representative quotes from responses")
}

class QuestionInsight {
  question string @description("The survey question")
  summary string @description("Concise summary of responses to this question")
  key_findings string[] @description("Top 3 key findings from responses")
  common_answers string[] @description("Most common types of answers")
  notable_outliers string[] @description("Interesting outlier responses worth noting")
}

class SegmentPattern {
  segment_name string @description("Descriptive name for this response segment")
  segment_description string @description("What characterizes this group")
  respondent_count int @description("Number of respondents in this segment")
  key_characteristics string[] @description("Defining characteristics of this segment")
  recommended_actions string[] @description("Suggested follow-up actions for this segment")
}

class AskLinkInsightsResponse {
  executive_summary string @description("2-3 sentence overview of all responses")
  total_responses int @description("Total number of responses analyzed")
  completion_rate int @description("Percentage of responses that were completed")

  top_themes ResponseTheme[] @description("Top 3-5 themes across all responses")
  question_insights QuestionInsight[] @description("Insights for each survey question")
  response_segments SegmentPattern[] @description("Distinct patterns/segments in respondents")

  recommended_followups string[] @description("Suggested follow-up questions or research")
  actionable_insights string[] @description("Clear, actionable insights from the data")
  data_quality_notes string[] @description("Notes about data quality or gaps")
}

function AnalyzeAskLinkResponses(
  ask_link_name: string,
  questions: string,
  responses_data: string,
  context: string
) -> AskLinkInsightsResponse {
  client "CustomGPT4o"
  prompt #"
    You are a research analyst specializing in survey analysis and qualitative data synthesis.

    ## Ask Link Survey: {{ ask_link_name }}

    ## Survey Questions
    {{ questions }}

    ## Response Data
    {{ responses_data }}

    ## Additional Context
    {{ context }}

    ## Your Task
    Analyze all survey responses to generate comprehensive insights:

    1. **Executive Summary**
       - Provide a 2-3 sentence overview capturing the most important findings
       - Focus on actionable insights, not just observations

    2. **Theme Analysis**
       - Identify 3-5 key themes that emerge across multiple responses
       - Note sentiment and provide representative quotes
       - Quantify frequency where possible

    3. **Question-by-Question Analysis**
       - For each question, summarize the responses
       - Highlight key findings and common patterns
       - Note any surprising or outlier responses worth investigating

    4. **Response Segmentation**
       - Identify distinct groups or patterns in respondents
       - What characterizes each segment?
       - What different follow-up might each segment need?

    5. **Actionable Recommendations**
       - What should the team do next based on these responses?
       - What follow-up questions or research would be valuable?
       - What decisions can be made from this data?

    ## Analysis Guidelines
    - Be specific and evidence-based - cite actual responses
    - Focus on patterns, not individual data points
    - Highlight unexpected findings and anomalies
    - Consider what questions the data doesn't answer
    - Provide actionable recommendations, not just observations

    {{ ctx.output_format }}
  "#
}

// Quick summary function for smaller response sets
class QuickResponseSummary {
  summary string @description("2-3 sentence summary of key findings")
  top_insights string[] @description("Top 3 insights from responses")
  sentiment_overview string @description("Overall sentiment: Positive | Neutral | Negative | Mixed")
  suggested_actions string[] @description("2-3 suggested next steps")
}

function SummarizeAskLinkResponses(
  ask_link_name: string,
  questions: string,
  responses_data: string
) -> QuickResponseSummary {
  client "CustomGPT4oMini"
  prompt #"
    Analyze these survey responses and provide a quick summary.

    ## Survey: {{ ask_link_name }}

    ## Questions
    {{ questions }}

    ## Responses
    {{ responses_data }}

    Provide:
    1. A 2-3 sentence summary of the key findings
    2. Top 3 insights (specific and evidence-based)
    3. Overall sentiment assessment
    4. 2-3 suggested next steps

    Focus on what's actionable and valuable for the team.

    {{ ctx.output_format }}
  "#
}

// Test for development
test AnalyzeAskLinkResponses_Sample {
  functions [AnalyzeAskLinkResponses]
  args {
    ask_link_name "Product Feedback Survey"
    questions #"
      1. What's your biggest challenge with our product?
      2. What feature would you most like to see added?
      3. How likely are you to recommend us to a colleague? (1-10)
      4. Any other feedback?
    "#
    responses_data #"
      ## Response 1 (john@acme.com) - Completed
      Q1: The onboarding process is confusing. Took me 3 days to figure out basic features.
      Q2: Better documentation and video tutorials
      Q3: 6
      Q4: Love the concept but execution needs work

      ## Response 2 (sarah@startup.io) - Completed
      Q1: Integration with our existing tools is painful
      Q2: Slack integration
      Q3: 8
      Q4: Great product, just needs more integrations

      ## Response 3 (mike@corp.co) - Completed
      Q1: Too many clicks to do simple things
      Q2: Keyboard shortcuts
      Q3: 7
      Q4: UI could be more efficient

      ## Response 4 (lisa@agency.com) - In Progress
      Q1: Onboarding was rough, almost gave up
      Q2: —
      Q3: —
      Q4: —
    "#
    context "Early-stage B2B SaaS product, 50 active users, seeking product-market fit"
  }
}
