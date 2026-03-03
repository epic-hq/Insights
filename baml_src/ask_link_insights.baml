// Ask Link Response Analysis
// Generates insights and summaries from survey/Ask link responses

class ResponseTheme {
  theme string @description("Key theme identified across responses (3-5 words)")
  description string @description("Brief description with specific numbers, e.g. '7 of 12 respondents (58%) mentioned onboarding friction'")
  frequency int @description("Number of responses mentioning this theme")
  percentage int @description("Percentage of total responses mentioning this theme (0-100)")
  sentiment string @description("Overall sentiment: Positive | Neutral | Negative | Mixed")
  example_quotes string[] @description("2-3 representative quotes from responses")
}

class AnswerDistribution {
  answer string @description("The answer value or category, e.g. 'Sales', 'Engineering', 'Marketing'")
  count int @description("Number of respondents who gave this answer")
  percentage int @description("Percentage of respondents (0-100)")
}

class QuestionInsight {
  question string @description("The survey question")
  summary string @description("Concise summary with specific numbers. BAD: 'Respondents come from various sectors'. GOOD: '42% Sales, 25% Engineering, 17% Marketing, 16% Other'")
  answer_distribution AnswerDistribution[] @description("Breakdown of answers by category with counts and percentages. For open-ended: group into meaningful categories. For select: use exact option values.")
  key_findings string[] @description("Top 3 key findings. Each MUST include a specific number or percentage. BAD: 'Many are at early stages'. GOOD: '8 of 12 (67%) are pre-revenue or MVP stage'")
  notable_outliers string[] @description("Interesting outlier responses worth noting — include the quote")
}

class SegmentPattern {
  segment_name string @description("Descriptive name for this response segment, e.g. 'Technical Founders (42%)'")
  segment_description string @description("What characterizes this group — be specific about count and percentage")
  respondent_count int @description("Number of respondents in this segment")
  percentage int @description("Percentage of total respondents in this segment (0-100)")
  key_characteristics string[] @description("Defining characteristics of this segment")
  recommended_actions string[] @description("Suggested follow-up actions for this segment")
}

class AskLinkInsightsResponse {
  executive_summary string @description("2-3 sentence overview. MUST include specific numbers. BAD: 'Respondents range from early to late stage'. GOOD: 'Of 12 respondents, 67% (8) are pre-revenue startups, while 25% (3) are Series A/B. The dominant pain point is onboarding friction, cited by 58% (7).'")
  total_responses int @description("Total number of responses analyzed")
  completion_rate int @description("Percentage of responses that were completed")

  top_themes ResponseTheme[] @description("Top 3-5 themes across all responses, each with frequency count and percentage")
  question_insights QuestionInsight[] @description("Insights for each survey question with answer distributions")
  response_segments SegmentPattern[] @description("Distinct patterns/segments in respondents with counts and percentages")

  recommended_followups string[] @description("Suggested follow-up questions or research")
  actionable_insights string[] @description("Clear, actionable insights. Each MUST cite a specific number. BAD: 'Improve onboarding'. GOOD: '58% cited onboarding friction — prioritize guided setup flow'")
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
    Analyze all survey responses to generate comprehensive, QUANTITATIVE insights.

    ## CRITICAL: Be Specific and Numeric
    Every finding MUST include concrete numbers and percentages. The reader should never see
    vague phrases like "across various sectors", "many respondents", "some users", or "a range of stages".

    EXAMPLES OF BAD vs GOOD OUTPUT:
    - BAD: "Stages range from pre-startup to Series A/B, with a focus on early-stage development"
    - GOOD: "67% (8 of 12) are pre-revenue or MVP stage, 25% (3) are Series A/B, 8% (1) is pre-idea"

    - BAD: "Many are at very early or MVP stages"
    - GOOD: "5 of 12 respondents (42%) are at MVP stage, 3 (25%) are pre-revenue"

    - BAD: "Respondents come from various industries"
    - GOOD: "33% SaaS/Tech, 25% Consulting, 17% Healthcare, 8% Education, 17% Other"

    ## Analysis Steps

    1. **Executive Summary** (2-3 sentences)
       - Lead with the most striking number: "Of N respondents, X% said..."
       - Mention the #1 theme with its percentage

    2. **Theme Analysis** (3-5 themes)
       - Each theme: count + percentage + representative quotes
       - Sort by frequency (most common first)

    3. **Question-by-Question Analysis**
       - For EVERY question, produce an answer_distribution breaking responses into categories
       - For select/likert: use exact option values with counts
       - For open-ended: categorize responses into meaningful groups (e.g. "Sales 30%, Marketing 20%, Engineering 25%, Other 25%")
       - Each key_finding must include a number

    4. **Response Segmentation**
       - Name segments with their percentage: "Technical Founders (42%)"
       - Include respondent_count AND percentage for each segment

    5. **Actionable Recommendations**
       - Tie each recommendation to a specific finding with its number
       - "58% cited onboarding friction → prioritize guided setup"

    ## Rules
    - Count responses carefully — your numbers must add up
    - Percentages should sum to ~100% within each distribution
    - Use "X of Y (Z%)" format for precision
    - For small samples (<10), show both count and percentage
    - Never round to make numbers look cleaner if it loses accuracy

    {{ ctx.output_format }}
  "#
}

// Quick summary function for smaller response sets
class QuickResponseSummary {
  summary string @description("1-2 sentence summary. Be HONEST about sample size - if only 1-2 quality responses, say 'Based on limited data from X respondent(s)...'")
  quality_responses_count int @description("Number of quality responses after filtering junk")
  total_responses_count int @description("Total responses including junk")
  top_insights string[] @description("1-3 BRIEF insights with specific numbers. BAD: 'Users face onboarding challenges'. GOOD: '2 of 3 (67%) cited onboarding friction'. If <3 quality responses, prefix with 'Limited data:'. Empty array if insufficient data.")
  sentiment_overview string @description("Overall sentiment: Positive | Neutral | Negative | Mixed | Insufficient data")
  suggested_actions string[] @description("1-2 brief actions. If <3 quality responses, just say 'Collect more responses before drawing conclusions'. Empty if no actionable data.")
  data_quality_warning string @description("Plain English warning like 'Only 1 of 3 responses contained meaningful answers - results are not statistically significant.' Empty if data quality is good (>50% quality).")
}

function SummarizeAskLinkResponses(
  ask_link_name: string,
  questions: string,
  responses_data: string
) -> QuickResponseSummary {
  client "CustomGPT4oMini"
  prompt #"
    Analyze these survey responses HONESTLY.

    ## Survey: {{ ask_link_name }}

    ## Questions
    {{ questions }}

    ## Responses
    {{ responses_data }}

    ## CRITICAL: Be Brutally Honest About Data Quality

    STEP 1: Count quality vs junk responses
    - Junk = gibberish ("asdf", "qwerty", random chars), test entries ("test", "123"), single characters, nonsense
    - Quality = thoughtful answers that actually address the questions
    - Report EXACT counts: quality_responses_count and total_responses_count

    STEP 2: Adjust your analysis based on sample size
    - If 0-1 quality responses: Say "Insufficient data to draw conclusions" - do NOT make up insights
    - If 2 quality responses: Be very cautious, prefix everything with "Limited data suggests..."
    - If 3+ quality responses: Can provide more confident insights, but still note sample size

    STEP 3: Be plain about data quality issues
    - If >50% responses were junk, put a clear warning in data_quality_warning
    - Example: "Only 1 of 3 responses contained meaningful answers. These results are not representative."

    ## Output Guidelines
    - summary: Start with sample size context ("Based on 1 quality response out of 3 total...")
    - top_insights: Keep VERY short (1 line each). If <3 quality responses, provide 1-2 max or empty array.
    - suggested_actions: If insufficient data, just say "Collect more responses" - don't make up actions
    - DO NOT pretend you have findings when you don't
    - DO NOT pad insights to hit a number - quality over quantity

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
