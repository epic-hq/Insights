// Nested Research Questions & Interview Prompts generation
// Input: goal + decision questions (+ optional audience context)
// Output: plan with decision_questions[], research_questions[], interview_prompts[], other_data_sources[]

class DecisionQuestionOut {
  id string @description("Unique UUID. Do not use PII.")
  text string @description("The business decision the user needs to make")
  rationale string @description("Why this decision is important for achieving the user's goal")
  key_metrics string[] @description("Concrete metrics that would inform this business decision")
  risks_if_wrong string[] @description("Business risks if this decision is made incorrectly")
}

class ResearchQuestionOut {
  id string @description("Unique UUID")
  dq_id string @description("Links to DecisionQuestionOut.id")
  text string @description("The research question that needs to be answered to inform the decision")
  rationale string @description("How answering this research question will help make the business decision")
  evidence_types string[] @description("Types of evidence needed: QUOTES, ANALYTICS, SURVEY, EXPERIMENT, OBSERVATIONS, MARKET_DATA")
  suggested_methods string[] @description("Research methods to gather this evidence (e.g., user interviews, analytics analysis)")
}

class InterviewPromptOut {
  id string @description("Unique UUID")
  rq_ids string[] @description("Links to ResearchQuestionOut.id")
  text string @description("Open-ended question to ask interviewees to gather evidence for the research question")
  followups string[] @description("Follow-up questions to ask interviewees to dig deeper")
  bias_checks string[] @description("Reminders to keep questions neutral and avoid leading the interviewee")
}

class ResearchPlanOut {
  goal string @description("The user's business goal they want to achieve")
  decision_questions DecisionQuestionOut[] @description("Business decisions the user needs to make")
  research_questions ResearchQuestionOut[] @description("Questions that need to be answered to inform decisions")
  interview_prompts InterviewPromptOut[] @description("Questions to ask interviewees to gather evidence")
  other_data_sources string[] @description("Additional data sources beyond interviews (analytics, surveys, etc.)")
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
    You are an expert UX researcher creating a research plan that connects business decisions to interview questions.

    CONTEXT - USER'S BUSINESS SITUATION:
    - Business Goal: {{ goal }}
    - Key Decisions They Need to Make:
    {% for dq in decision_questions %}
      - {{ dq }}
    {% endfor %}
    - Target Interview Participants: {{ target_roles }} at {{ target_orgs }}

    IMPORTANT DISTINCTION:
    - The USER is the one with the business goal and decisions to make
    - The INTERVIEWEES are {{ target_roles }} who will be interviewed to provide insights
    - Interview questions should ask interviewees about THEIR experiences, not the user's business decisions

    If custom instructions are provided, follow them strictly:
    CUSTOM INSTRUCTIONS:
    {{ custom_instructions }}

    REQUIREMENTS:

    1) decision_questions: For each business decision the user needs to make:
       - id: sequential like dq1, dq2, ...
       - text: clear business decision the user faces
       - rationale: why this decision matters for achieving their business goal
       - key_metrics: 2-4 concrete metrics that would inform this business decision
       - risks_if_wrong: 1-3 business risks if decided incorrectly

    2) research_questions: For each decision, create 1-3 research questions that need answers:
       - id: rq{dq index}{letter} e.g., rq1a, rq1b, ...
       - dq_id: link to the parent decision question id
       - text: what needs to be learned from {{ target_roles }} to inform the business decision
       - rationale: how this research insight will help make the business decision
       - evidence_types: 1-3 tags (QUOTES, ANALYTICS, SURVEY, EXPERIMENT, OBSERVATIONS, MARKET_DATA, SUPPORT_TICKETS, BETA_LOGS)
       - suggested_methods: 1-3 methods (e.g., user interviews, segmented analytics, A/B test, survey)

    3) interview_prompts: Create interview questions to ask {{ target_roles }} at {{ target_orgs }}:
       - id: ip1, ip2, ...
       - rq_ids: one or more linked research question ids
       - text: OPEN-ENDED question asking interviewees about THEIR experiences, behaviors, or perspectives (NOT about the user's business decisions)
       - followups: 2-3 follow-up questions to dig deeper into the interviewee's experiences
       - bias_checks: 1-2 reminders to keep questions neutral and avoid leading the interviewee

    4) other_data_sources: 2-4 additional data sources beyond interviews (analytics, logs, competitor research, surveys, etc.).

    INTERVIEW QUESTION GUIDELINES:
    - Ask interviewees about THEIR experiences, not the user's business
    - Use "Tell me about..." "Walk me through..." "Describe..." formats
    - Focus on behaviors, motivations, pain points, and decision-making processes
    - Avoid yes/no questions and leading language
    - Make questions specific to {{ target_roles }} at {{ target_orgs }}
    - Example: Instead of "How should we improve our pricing?" ask "Tell me about your experience evaluating and choosing between similar products or services"

    Return only valid JSON that matches the schema exactly:
    {{ ctx.output_format }}
  "#
}
