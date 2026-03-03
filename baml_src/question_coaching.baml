// Question Coaching — lean, pithy nudges for the Uppy chat experience.
// Unlike EvaluateInterviewQuestion (full eval with scores), this produces
// short coaching nudges suitable for rendering as chat cards.

class CoachingNudge {
  questionIndex int @description("1-based index of the question in the list")
  issue "leading" | "double_barreled" | "closed_ended" | "too_long" | "too_vague" | "biased" | "jargon" | "redundant" | "survey_fatigue"
  summary string @description("Pithy 5-10 word description. E.g. 'Leading — presupposes frustration' or 'Double-barreled — asks two things'")
  alternatives string[] @description("1-2 suggested rewrites. Short, direct, ready to use.")
}

class CoachingResult {
  nudges CoachingNudge[] @description("Only questions with issues. Empty array if all questions are fine.")
  totalTimeWarning string? @description("If the survey/interview seems too long, a short warning like '~8 min — consider trimming to 5'. Null if fine.")
  overallNote string? @description("Optional one-line observation about the question set, e.g. 'Heavy on pain points, missing any goals questions'. Null if nothing notable.")
}

function CoachQuestionSet(
  questions: string[],
  question_context: string,
  mode: string
) -> CoachingResult {
  client CustomGPT4oMini
  prompt #"
    You are an expert research methodologist coaching someone on their {{ mode }} questions.
    Your job is to flag problems and suggest fixes — but ONLY when there's a real issue.
    Be pithy. No lectures. Reference questions by number only (the user can see them).

    QUESTIONS:
    {% for q in questions %}
    {{ loop.index }}. {{ q }}
    {% endfor %}

    CONTEXT: {{ question_context }}
    MODE: {{ mode }}

    ISSUES TO CATCH:

    HIGH PRIORITY (always flag):
    - Leading: presupposes an answer ("Don't you think X is frustrating?")
    - Double-barreled: asks two things ("How do you feel about X and Y?")
    - Closed-ended in interview mode: yes/no when open-ended would be richer

    MEDIUM PRIORITY:
    - Too vague: won't produce actionable data ("Tell me about your experience")
    - Biased framing: emotionally loaded language
    - Jargon: terms the respondent might not know
    - Redundant: two questions asking essentially the same thing

    SURVEY-SPECIFIC (only in survey mode):
    - Survey fatigue: too many open-ended questions back-to-back
    - Too long: question text over ~25 words is hard to scan

    RULES:
    1. Only flag questions with real problems. Most questions are fine — return empty nudges if so.
    2. Keep summaries to 5-10 words. Format: "Issue type — brief reason"
    3. Suggest 1-2 alternatives max. Make them ready to use, not vague directions.
    4. If total estimated response time exceeds 5 min for surveys or 45 min for interviews, add totalTimeWarning.
    5. overallNote only if there's a notable pattern (e.g. all pain, no goals). Otherwise null.
    6. Never repeat the full question text in your summary — just reference by number.

    {{ ctx.output_format }}
  "#
}

// Quick single-question check (for real-time as-you-type coaching)
class QuickCoachResult {
  hasIssue bool @description("True if there's something worth flagging")
  issue string? @description("Issue type if flagged, e.g. 'leading'")
  summary string? @description("5-10 word description if flagged")
  alternative string? @description("One suggested rewrite if flagged")
}

function CoachSingleQuestion(
  question: string,
  question_context: string,
  mode: string
) -> QuickCoachResult {
  client CustomGPT4oMini
  prompt #"
    You are a research methodologist. Quickly evaluate this {{ mode }} question:

    "{{ question }}"

    Context: {{ question_context }}

    Only flag if there's a genuine problem (leading, double-barreled, closed-ended, too vague, biased).
    Most questions are fine — return hasIssue: false for acceptable questions.

    If flagged, provide:
    - issue: the type (leading, double_barreled, closed_ended, too_vague, biased, jargon)
    - summary: 5-10 words ("Leading — presupposes frustration")
    - alternative: one ready-to-use rewrite

    {{ ctx.output_format }}
  "#
}
