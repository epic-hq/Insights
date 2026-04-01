// Ask Link Response Analysis
// Generates insights and summaries from survey/Ask link responses

class ResponseTheme {
  theme string @description("Key theme identified across responses (3-5 words)")
  description string @description("Brief description with counts, e.g. '7 of 12 people mentioned onboarding friction'. Use 'early signal' for themes from <3 people.")
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
  summary string @description("Plain-English summary. Start with how many people answered. BAD: 'Respondents come from various sectors'. GOOD: '10 of 12 answered — mostly Sales (5) and Engineering (3)'")
  answer_distribution AnswerDistribution[] @description("Breakdown of answers by category with counts. For open-ended: group into meaningful categories. For select: use exact option values. Only include people who actually answered.")
  key_findings string[] @description("Top 2-3 findings in plain language. Use counts first, percentages optional. BAD: 'Many are at early stages'. GOOD: '8 of 12 are pre-revenue or MVP stage'. If <5 answered, be brief and honest about the thin data.")
  notable_outliers string[] @description("Interesting outlier responses worth noting — include the quote")
}

class SegmentPattern {
  segment_name string @description("Descriptive name for this group, e.g. 'Technical Founders (5 people)'")
  segment_description string @description("What makes this group different — use counts, keep it plain")
  respondent_count int @description("Number of respondents in this segment")
  percentage int @description("Percentage of total respondents in this segment (0-100)")
  key_characteristics string[] @description("Defining characteristics of this segment")
  recommended_actions string[] @description("Suggested follow-up actions for this segment")
}

class AskLinkInsightsResponse {
  executive_summary string @description("2-3 sentence plain-English overview. Lead with the most useful takeaway. If response rates are low, say so upfront. E.g. 'We heard from 12 people. 8 are pre-revenue startups, and the biggest pain point is onboarding — 7 people brought it up.'")
  total_responses int @description("Total number of responses analyzed")
  completion_rate int @description("Percentage of responses that were completed")

  top_themes ResponseTheme[] @description("Top 3-5 themes across all responses, each with frequency count. Themes based on <3 responses should be labeled 'early signal'")
  question_insights QuestionInsight[] @description("Insights for each survey question — always note how many people actually answered vs total")
  response_segments SegmentPattern[] @description("Distinct patterns/segments in respondents. If <10 total responses, return empty array with a note in data_quality_notes instead")

  recommended_followups string[] @description("Suggested follow-up questions or research")
  actionable_insights string[] @description("Practical advice tied to specific findings. E.g. '7 people flagged onboarding friction — worth prioritizing a guided setup'. If data is thin, lead with 'Get more responses before making big decisions'")
  data_quality_notes string[] @description("Honest notes about data quality, low response rates, drop-off patterns, or anything that limits confidence in the findings")
}

function AnalyzeAskLinkResponses(
  ask_link_name: string,
  questions: string,
  responses_data: string,
  context: string
) -> AskLinkInsightsResponse {
  client "CustomGPT4o"
  prompt #"
    You are a sharp, no-BS business advisor who tells it like it is. You speak plainly —
    like you're explaining findings to a smart friend over coffee, not writing a corporate report.

    ## Ask Link Survey: {{ ask_link_name }}

    ## Survey Questions
    {{ questions }}

    ## Response Data
    {{ responses_data }}

    ## Additional Context
    {{ context }}

    ## Your Task
    Analyze the survey responses and tell the reader what actually matters — in plain language.

    ## CRITICAL: Honesty Over Spin

    ### Non-responses are NOT data
    If only 3 out of 12 people answered a question, do NOT say "75% have not yet identified challenges."
    Say "Only 3 people answered this, so we can't draw strong conclusions yet. Here's what those 3 said..."
    Non-response means they skipped it — never frame skipping as a finding.

    ### Small numbers = use counts, not percentages
    When fewer than 10 people answered a question, lead with raw counts. "2 people mentioned marketing"
    is honest. "17% identified marketing as a skill gap" from 2 people is misleading.
    - Under 10 responses: "2 out of 12 said X" (count first, percentage optional in parentheses)
    - 10+ responses: percentages are fine as the primary format
    - NEVER use percentages to make tiny samples sound statistically meaningful

    ### Flag drop-off as an insight
    If a question has much lower response rates than earlier questions, call that out explicitly.
    "Only 2 of 12 people answered this — that drop-off itself might mean the question felt irrelevant
    or came too late in the survey."

    ### Write like a human, not a consultant
    - BAD: "Funding and time management are significant obstacles (17%)"
    - GOOD: "One person flagged funding concerns, another mentioned time management — but with only 2 answers, it's too early to call these trends."

    - BAD: "83% have not yet identified specific challenges"
    - GOOD: "10 people skipped this question entirely. The 2 who answered mentioned funding and time management."

    - BAD: "Marketing is the most cited need, mentioned by 17%"
    - GOOD: "Both people who answered this question mentioned needing marketing skills."

    ## Be Specific and Numeric (but honestly)
    Use real numbers — just don't use them to inflate weak data.

    EXAMPLES:
    - GOOD: "8 of 12 (67%) are pre-revenue — this is clearly an early-stage group"
    - GOOD: "Only 2 people answered, so take this lightly: both mentioned marketing"
    - BAD: "Respondents come from various industries" (too vague)
    - BAD: "17% identified marketing as a skill gap" (misleading when n=2)

    ## Analysis Steps

    1. **Executive Summary** (2-3 sentences)
       - Lead with the most useful takeaway, stated plainly
       - If response rates are low, acknowledge that upfront
       - Mention the #1 theme with actual count

    2. **Theme Analysis** (3-5 themes)
       - Each theme: count + representative quotes
       - Sort by frequency (most common first)
       - If a "theme" is based on fewer than 3 responses, label it as "early signal" not a finding

    3. **Question-by-Question Analysis**
       - You MUST produce a question_insight for EVERY question in the survey, even if only 1 person answered
       - For each question, note how many people actually answered vs total
       - For select/likert: use exact option values with counts
       - For open-ended: group responses into categories with counts
       - For text questions with 1-2 responses: still provide a brief summary and include the response(s) as findings
       - If <5 people answered, keep the analysis brief and honest about limitations
       - If this is a branched survey, note which path/route the question belongs to

    4. **Response Segmentation**
       - Only create segments if you have enough data (10+ responses) to make them meaningful
       - For smaller datasets, skip segmentation and say "Not enough responses to identify reliable segments"

    5. **Actionable Recommendations**
       - Tie each recommendation to what you actually saw
       - If data is thin, the #1 recommendation should be "Get more responses before making decisions"
       - Be practical: "Here's what I'd do with this info" not "It is recommended that stakeholders..."

    ## Tone Rules
    - Write like a smart advisor talking to a founder, not a research report
    - Short sentences. No jargon. No corporate filler.
    - Say "people" not "respondents." Say "answered" not "indicated."
    - If something is unclear or inconclusive, just say so — don't dress it up
    - It's okay to say "we don't have enough data to know" — that IS an insight

    ## Number Rules
    - Count responses carefully — your numbers must add up
    - Percentages should sum to ~100% within each distribution
    - For small samples (<10), lead with "X of Y" counts, percentages in parentheses only
    - For larger samples (10+), "X% (N)" format is fine
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
