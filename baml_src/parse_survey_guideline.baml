// Parse natural language survey guidelines into structured branching rules
// Input: User's natural language + survey questions
// Output: Structured rules the branching engine can execute

enum ConditionOperator {
  EQUALS
  NOT_EQUALS
  CONTAINS
  NOT_CONTAINS
  SELECTED
  NOT_SELECTED
  ANSWERED
  NOT_ANSWERED
}

enum GuidelineAction {
  SKIP_TO
  END_SURVEY
}

enum RuleConfidence {
  HIGH
  MEDIUM
  LOW
}

class SurveyQuestionInput {
  id string
  prompt string
  type string
  options string[]?
}

class ParsedCondition {
  questionId string @description("ID of the question this condition checks")
  questionPrompt string @description("The question text, for verification")
  operator ConditionOperator
  value string? @description("Value to compare against, if applicable")
}

class ParsedGuideline {
  id string @description("Unique identifier like 'gl1', 'gl2'")
  naturalLanguage string @description("Original user input, preserved for display")
  summary string @description("Human-readable: 'When sponsors respond, skip to budget questions'")
  condition ParsedCondition
  action GuidelineAction
  targetQuestionId string? @description("For SKIP_TO: which question to jump to")
  targetQuestionPrompt string? @description("The target question text, for verification")
  guidance string? @description("AI hint for chat mode: 'Probe on approval process'")
  reasoning string @description("Why this interpretation makes sense")
  confidence RuleConfidence
  ambiguityNotes string? @description("If medium/low confidence, what's unclear")
}

class GuidelineParseResult {
  guidelines ParsedGuideline[]
  unparseableSegments string[] @description("Parts of input that couldn't be mapped to rules")
  suggestedClarifications string[] @description("Questions to ask user if ambiguous")
  overallConfidence RuleConfidence
}

function ParseSurveyGuidelines(
  userInput: string,
  questions: SurveyQuestionInput[],
  existingGuidelineSummaries: string[]
) -> GuidelineParseResult {
  client CustomGPT4oMini
  prompt #"
    You are parsing natural language survey guidelines into structured branching rules.

    USER'S GUIDELINE INPUT:
    "{{ userInput }}"

    AVAILABLE QUESTIONS IN SURVEY:
    {% for q in questions %}
    - ID: {{ q.id }} | Type: {{ q.type }} | Prompt: "{{ q.prompt }}"
      {% if q.options %}Options: {{ q.options | join(", ") }}{% endif %}
    {% endfor %}

    EXISTING GUIDELINES (avoid conflicts):
    {% for g in existingGuidelineSummaries %}
    - {{ g }}
    {% endfor %}

    PARSING RULES:

    1. IDENTIFY TRIGGER CONDITIONS:
       - "If they're a sponsor" -> condition on a question about role/relationship
       - "For enterprise companies" -> condition on company size question
       - "When they mention X" -> CONTAINS operator on text response
       - "If they select Y" -> EQUALS operator on select question
       - "For respondents who..." -> Look for qualifying question

    2. IDENTIFY ACTIONS:
       - "focus on X questions" -> SKIP_TO the first X-related question
       - "skip the budget questions" -> SKIP_TO question after budget section
       - "end the survey" -> END_SURVEY
       - "ask about Y" -> SKIP_TO the Y question

    3. MATCH TO ACTUAL QUESTIONS:
       - Map referenced topics to actual question IDs from the list above
       - If user says "budget questions" find questions about budget
       - If ambiguous, note low confidence and suggest clarification

    4. GENERATE HUMAN-FRIENDLY SUMMARY:
       - Use natural phrasing: "When sponsors respond, skip to budget questions"
       - Use "For respondents who...", "When...", "If..."
       - Never say "rule" - say "guideline" or just describe the behavior

    5. ADD GUIDANCE FOR CHAT MODE:
       - If the condition implies a persona (sponsor, enterprise, etc.)
       - Add guidance like "Probe on ROI expectations" or "Focus on scale challenges"

    6. HANDLE AMBIGUITY:
       - If multiple questions could match, pick most likely and note uncertainty
       - If no question matches, add to unparseableSegments
       - Suggest specific clarifications the user could provide

    7. CONFLICT DETECTION:
       - Check against existing guidelines for contradictions
       - Flag if new guideline would make questions unreachable

    OUTPUT HIGH CONFIDENCE WHEN:
    - User explicitly references question text or options
    - Clear action verb (skip, end, focus, ask)
    - Unambiguous condition

    OUTPUT MEDIUM CONFIDENCE WHEN:
    - Topic references are vague but inferable
    - Multiple questions could be the trigger (picked most likely)

    OUTPUT LOW CONFIDENCE WHEN:
    - Cannot confidently match to any question
    - Action is very unclear

    Return only valid JSON matching the schema:
    {{ ctx.output_format }}
  "#
}

// Test for the parser
test ParseSponsorGuideline {
  functions [ParseSurveyGuidelines]
  args {
    userInput "If they're a sponsor, focus on ROI and budget questions"
    questions [
      { id: "q1", prompt: "What's your relationship with us?", type: "single_select", options: ["Member", "Sponsor", "Board Member", "Attendee"] },
      { id: "q2", prompt: "What value do you get from membership?", type: "long_text", options: null },
      { id: "q3", prompt: "What's your budget for sponsorship?", type: "short_text", options: null },
      { id: "q4", prompt: "How do you measure ROI?", type: "long_text", options: null }
    ]
    existingGuidelineSummaries []
  }
}
