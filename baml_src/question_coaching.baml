// Question Coaching — lean, pithy nudges for the Uppy chat experience.
// Unlike EvaluateInterviewQuestion (full eval with scores), this produces
// short coaching nudges suitable for rendering as chat cards.

class CoachingNudge {
  questionIndex int @description("1-based index of the question in the list")
  reasoning string @description("Internal: one sentence explaining WHY this is flagged. Forces careful evaluation before labeling.")
  issue "leading" | "double_barreled" | "closed_ended" | "too_long" | "too_vague" | "biased" | "jargon" | "redundant" | "survey_fatigue" | "hypothetical" | "not_behavioral" | "too_complex"
  summary string @description("Pithy 5-10 word description. E.g. 'Leading — presupposes frustration' or 'Double-barreled — asks two things'")
  alternatives string[] @description("1-2 suggested rewrites. Short, direct, ready to use. Must preserve the original question's intent and type.")
}

class CoachingResult {
  nudges CoachingNudge[] @description("Only questions with issues. Empty array if all questions are fine.")
  totalTimeWarning string? @description("If the survey/interview seems too long, a short warning with a target. Null if fine.")
  overallNote string? @description("Optional one-line observation about the question set, e.g. 'Heavy on pain points, missing goals and past behavior'. Null if nothing notable.")
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

    SURVEY BASELINES (use in survey mode):
    - If context suggests quick/new audience/no incentives OR context is unclear, optimize for low-commitment completion:
      target 5-7 questions, about 2-3 minutes, hard cap ~4 minutes.
    - For warm/incentivized audiences, 8-10 questions and ~4-6 minutes can be acceptable.
    - Use simple language, one idea per question, neutral tone.
    - If a question is NPS/likelihood-to-recommend, prefer 1-10 scale with labeled endpoints.
    - Prioritize past behavior, lived experiences, pain, and goals over hypotheticals and feature wishlists.

    ISSUES TO CATCH (priority order):

    HIGH PRIORITY (always flag):
    - Leading: presupposes an answer or uses loaded framing ("Don't you think X is frustrating?")
    - Double-barreled: two distinct predicates where a respondent could reasonably have different answers to each part ("How do you feel about X and Y?")
    - Closed-ended in interview mode ONLY: yes/no when open-ended would be richer. Never flag closed-ended in survey mode.

    MEDIUM PRIORITY:
    - Too vague: won't produce actionable data, no specific object of inquiry ("Tell me about your experience")
    - Biased: emotionally loaded language distinct from leading — charged adjectives/superlatives
    - Jargon: terms the respondent likely won't know. CHECK CONTEXT FIRST — technical audiences expect domain terms.
    - Redundant: two questions that would produce substantially the same data
    - Hypothetical: asks future intent/speculation without past-behavior anchor
    - Not behavioral: opinion/preference only, no lived experience anchor
    - Too complex: long/dense phrasing or multiple cognitive tasks

    SURVEY-SPECIFIC (survey mode only):
    - Survey fatigue: 3+ consecutive open-ended prompts or too many high-effort prompts in a short survey
    - Too long: question text over ~25 words is hard to scan

    DO NOT FLAG these patterns (they look suspicious but are fine):
    - "What do you think about X and Y?" when X and Y are the same dimension (not double-barreled)
    - "How has your experience with [product] changed over time?" — "changed" is not leading
    - "Can you tell me more about..." — closed-ended phrasing but genuinely open intent
    - "How do you feel about the pricing and cost?" — synonyms, not double-barreled
    - Neutral words like "challenges", "experience", "goals" by themselves

    EXAMPLES for often-missed quality upgrades:
    - Hypothetical: "Would you use X?" -> "Tell me about the last time you tried to solve this problem."
    - Not behavioral: "How important is onboarding quality?" -> "Walk me through your last onboarding experience."
    - Too complex: "Describe your entire process from discovery to renewal..." -> split into one focused step.

    RULES:
    1. Only flag questions with real problems. Most questions are fine — return empty nudges if so.
    2. For each flagged question, first write a reasoning sentence explaining WHY, then produce the summary.
    3. Keep summaries to 5-10 words. Format: "Issue type — brief reason"
    4. Suggest 1-2 alternatives max. Make them ready to use. Preserve intent and expected answer format.
    5. In survey mode, if estimated completion appears above quick baseline, add totalTimeWarning with explicit target.
    6. overallNote only if there is a notable set-level pattern (e.g., all solutioning/no behavior, all pain/no goals, too many open-ended). Otherwise null.
    7. Never repeat the full question text in summary — reference by number.

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

    Check issues in this order. STOP at the first real issue found:
    1. Is it leading? (presupposes an answer or uses loaded framing)
    2. Is it double-barreled? (two distinct predicates with potentially different answers — NOT synonyms)
    3. In interview mode only: is it closed-ended when open-ended would be richer?
    4. Is it too vague to produce actionable data?
    5. Is the language biased/emotionally loaded?
    6. Does it contain jargon the audience wouldn't know? (Check context)
    7. In survey mode, is it hypothetical/opinion-only without anchoring in past behavior?
    8. Is wording too complex for quick answering?

    Most questions are fine — return hasIssue: false for acceptable questions.

    DO NOT flag:
    - "Can you tell me more about..." (open intent despite closed phrasing)
    - Questions using "and" to join synonyms ("pricing and cost")
    - Follow-up questions that reference a topic already raised
    - Neutral words like "challenges", "experience", "goals"

    If flagged, provide:
    - issue: the type (leading, double_barreled, closed_ended, too_vague, biased, jargon, hypothetical, not_behavioral, too_complex)
    - summary: 5-10 words ("Leading — presupposes frustration")
    - alternative: one ready-to-use rewrite that preserves the original intent

    {{ ctx.output_format }}
  "#
}
