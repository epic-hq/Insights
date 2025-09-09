// Question Quality Evaluation - evaluates custom questions for research best practices

class QuestionIssue {
  type "leading" | "closed_ended" | "too_vague" | "compound" | "biased" | "jargon" | "assume_knowledge"
  description string @description("Brief explanation of the issue")
  severity "high" | "medium" | "low" @description("How problematic this issue is")
}

class QuestionImprovement {
  original_question string
  suggested_rewrite string @description("Improved version of the question")
  explanation string @description("Why this version is better")
}

class QuestionEvaluation {
  overall_quality "green" | "yellow" | "red" @description("Traffic light indicator of question quality")
  score int @description("0-100 quality score")
  strengths string[] @description("What makes this question effective")
  issues QuestionIssue[] @description("Problems identified with the question")
  improvement QuestionImprovement? @description("Suggested improvement if needed")
  recommendation "proceed" | "revise" @description("Should user proceed or revise the question")
  quick_feedback string @description("One-sentence summary of the assessment")
}

function EvaluateInterviewQuestion(
  question: string,
  research_context: string
) -> QuestionEvaluation {
  client CustomGPT4oMini
  prompt #"
    You are an expert UX researcher evaluating the quality of an interview question for exploratory research.

    QUESTION TO EVALUATE:
    "{{ question }}"

    RESEARCH CONTEXT:
    {{ research_context }}

    EVALUATION CRITERIA (be encouraging, practical, and not nit‑picky):
    
    1. OPEN-ENDED: Encourage detailed, story-based responses (primary goal in exploratory).
    2. NON-LEADING: Avoid suggestive or binary phrasing.
    3. CLEAR & SPECIFIC: One topic, understandable in plain language.
    4. CONVERSATIONAL: Friendly, natural tone.
    5. ACTIONABLE: Likely to produce useful insights about the goal.

    COMMON ISSUES TO FLAG (but don’t over-penalize if the question is broadly open‑ended):

    HIGH SEVERITY:
    - Leading questions that bias responses ("Don't you think X is better?")
    - Yes/no or closed-ended questions
    - Multiple questions in one (compound questions)
    - Assumes knowledge the interviewee may not have

    MEDIUM SEVERITY:
    - Too vague or broad ("Tell me about your experience")
    - Contains jargon or technical terms inappropriate for audience
    - Potentially sensitive or awkward phrasing

    LOW SEVERITY:
    - Could be more conversational
    - Minor clarity improvements possible

    QUALITY SCORING (be lenient for exploratory mode):
    - GREEN (75-100): Open-ended, non-leading, and broadly clear/conversational — proceed as-is
    - YELLOW (55-74): Good direction; offer a small rewrite to be more specific/clear
    - RED (0-54): Only if clearly leading, yes/no, or compound; provide a simple rewrite

    PROVIDE (keep feedback calm, consistent, and practical):
    1. Overall quality rating (green/yellow/red)
    2. Numeric score (0-100)
    3. Specific strengths of the question
    4. Any issues found with severity levels
    5. Suggested improvement if yellow/red — a single clear rewrite; prefer “Tell me about…”/“Walk me through…” patterns with a concrete example
    6. Clear recommendation (proceed/revise)
    7. One-sentence quick feedback (casual tone; avoid moving goalposts)

    Be encouraging but honest. Focus on what makes questions effective for generating rich insights.
    If the user’s latest version already addresses prior feedback, do not suggest a different change. Prefer stability and clarity.

    Output format:
    {{ ctx.output_format }}
  "#
}

// Batch evaluation for multiple questions
class BatchEvaluationResult {
  evaluations QuestionEvaluation[]
  overall_summary string @description("Summary of the question set quality")
  top_priorities string[] @description("Most important improvements to make")
}

function EvaluateQuestionSet(
  questions: string[],
  research_context: string
) -> BatchEvaluationResult {
  client CustomGPT4oMini
  prompt #"
    You are evaluating a set of interview questions for research quality.

    QUESTIONS TO EVALUATE:
    {% for question in questions %}
    {{ loop.index }}. "{{ question }}"
    {% endfor %}

    RESEARCH CONTEXT:
    {{ research_context }}

    Evaluate each question individually using the same criteria as single question evaluation, then provide:
    
    1. Individual evaluation for each question
    2. Overall summary of the question set's strengths and weaknesses
    3. Top 2-3 priorities for improvement across the entire set

    Look for issues like:
    - Too many similar questions (redundancy)
    - Missing important question types (no behavioral questions, etc.)
    - Inconsistent tone or style
    - Overall flow and progression

    Output format:
    {{ ctx.output_format }}
  "#
}
