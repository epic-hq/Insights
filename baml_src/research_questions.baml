// Nested Research Questions & Interview Prompts generation
// Input: goal + decision questions (+ optional audience context)
// Output: plan with decision_questions[], research_questions[], interview_prompts[], other_data_sources[]

class DecisionQuestionOut {
  id string @description("Stable id like 'dq1' in local context. Do not use PII.")
  text string
  rationale string
  key_metrics string[]
  risks_if_wrong string[]
}

class ResearchQuestionOut {
  id string @description("Local id like 'rq1a' unique within response")
  dq_id string @description("Links to DecisionQuestionOut.id")
  text string
  rationale string
  evidence_types string[] @description("Tags like QUOTES, ANALYTICS, SURVEY, EXPERIMENT, OBSERVATIONS, MARKET_DATA")
  suggested_methods string[]
}

class InterviewPromptOut {
  id string @description("Local id like 'ip1'")
  rq_ids string[] @description("Links to ResearchQuestionOut.id")
  text string
  followups string[]
  bias_checks string[]
}

class ResearchPlanOut {
  goal string
  decision_questions DecisionQuestionOut[]
  research_questions ResearchQuestionOut[]
  interview_prompts InterviewPromptOut[]
  other_data_sources string[]
}

function GenerateNestedResearchQuestions(
  goal: string,
  decision_questions: string[],
  target_orgs: string,
  target_roles: string,
  custom_instructions: string
) -> ResearchPlanOut {
  client CustomGPT4oMini
  prompt #"
    You are an expert UX researcher. Create a compact research plan with nested structure linking:
    decision questions → research questions → interview prompts.

    CONTEXT:
    - Goal: {{ goal }}
    - Decision Questions (verbatim list):
    {% for dq in decision_questions %}
      - {{ dq }}
    {% endfor %}
    - Target Orgs: {{ target_orgs }}
    - Target Roles/Segments: {{ target_roles }}

    If custom instructions are provided, follow them strictly:
    CUSTOM INSTRUCTIONS:
    {{ custom_instructions }}

    REQUIREMENTS:
    1) decision_questions: For each input, produce:
       - id: sequential like dq1, dq2, ...
       - text: clear decision question
       - rationale: why this matters for the goal
       - key_metrics: 2-4 concrete metrics that would inform the decision
       - risks_if_wrong: 1-3 key risks

    2) research_questions: For each decision question, generate 1-3 specific research
       questions. Provide:
       - id: rq{dq index}{letter} e.g., rq1a, rq1b, ...
       - dq_id: link to the parent decision question id
       - text
       - rationale
       - evidence_types: 1-3 tags (QUOTES, ANALYTICS, SURVEY, EXPERIMENT, OBSERVATIONS, MARKET_DATA, SUPPORT_TICKETS, BETA_LOGS)
       - suggested_methods: 1-3 methods (e.g., user interviews, segmented analytics, A/B test, survey)

    3) interview_prompts: Create 1-2 prompts per research question (merge where natural):
       - id: ip1, ip2, ...
       - rq_ids: one or more linked research question ids
       - text: conversational, neutral, open-ended
       - followups: 2-3 concise follow-ups
       - bias_checks: 1-2 neutral-framing reminders

    4) other_data_sources: 2-4 additional sources relevant to the goal (analytics, logs, competitor, market data, etc.).

    TONE & QUALITY:
    - Prompts must be conversational and unbiased. Avoid yes/no and leading language.
    - Be specific to the audience ({{ target_orgs }} / {{ target_roles }}), avoid generic phrasing.
    - Prefer concrete, falsifiable research questions.

    Return only valid JSON that matches the schema exactly:
    {{ ctx.output_format }}
  "#
}

