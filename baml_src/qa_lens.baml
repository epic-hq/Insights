// Q&A Lens - Extract question-answer pairs from interviews
// This lens pairs interviewer questions with participant responses
// to create a structured Q&A summary document

class QAPair {
  question string @description("The interviewer's question, cleaned up for readability")
  question_evidence_id string @description("Evidence ID (8-char prefix) of the question turn")
  answer string @description("Synthesized 1-3 sentence answer from participant response")
  answer_evidence_ids string[] @description("Evidence IDs (8-char prefixes) supporting the answer")
  answer_verbatim string? @description("Best direct quote from response (≤30 words)")
  answer_start_ms int? @description("Start timestamp in milliseconds for the answer")
  confidence float @description("0.0-1.0: How complete/clear the answer is")
  follow_up_needed bool @description("True if answer was incomplete, unclear, or needs elaboration")
  topic string? @description("Short topic label for grouping (e.g., 'workflow', 'pain points', 'tools')")
}

class QALensResult {
  executive_summary string @description("2-3 sentence summary of the key learnings from this Q&A session")
  qa_pairs QAPair[] @description("Question-answer pairs in chronological order")
  unanswered_questions string[] @description("Questions that weren't answered or were deflected")
  key_takeaways string[] @description("3-5 main learnings distilled from all Q&A pairs")
  topics_covered string[] @description("List of main topics discussed")
  overall_confidence float @description("Average confidence across all Q&A pairs")
}

function ExtractQAPairs(
  evidence_json: string,
  interview_context: string,
  focus_areas: string?
) -> QALensResult {
  client CustomGPT4o
  prompt #"
    You are an expert at extracting structured Q&A pairs from interview transcripts.
    Your goal is to create a clean, scannable Q&A document that captures the essence of the conversation.

    ## Interview Context
    {{ interview_context }}

    {% if focus_areas %}
    ## Focus Areas
    Prioritize questions related to: {{ focus_areas }}
    {% endif %}

    ## Evidence from Interview
    {{ evidence_json }}

    ## Instructions

    ### 1. Identify Question-Answer Pairs
    - Look for evidence marked with is_question=true OR from speakers with role="interviewer"
    - Match each question to the subsequent response(s) from the participant
    - A single question may have answers spread across multiple evidence items
    - Skip procedural questions ("Can you hear me?", "Should we continue?")
    - Skip social pleasantries ("How are you?", "Nice to meet you")

    ### 2. For Each Q&A Pair
    - **question**: Clean up the question for readability (fix grammar, remove filler words)
    - **question_evidence_id**: Use the 8-character ID prefix of the question evidence
    - **answer**: Synthesize a clear 1-3 sentence answer that captures the key point
    - **answer_evidence_ids**: Include ALL evidence IDs that contribute to the answer
    - **answer_verbatim**: Pick the single best quote that captures the essence (if impactful)
    - **answer_start_ms**: Use the start_ms from the first answer evidence for timestamp linking
    - **confidence**: Rate how complete/clear the answer is:
      - 0.9+: Clear, complete answer with specific details
      - 0.7-0.9: Good answer but could use more detail
      - 0.5-0.7: Partial answer or somewhat vague
      - <0.5: Unclear, deflected, or barely answered
    - **follow_up_needed**: True if the answer is incomplete or raises more questions
    - **topic**: Assign a short topic label for grouping similar Q&As

    ### 3. Identify Unanswered Questions
    - List questions that were asked but not answered
    - Include questions that were deflected or answered with "I don't know"

    ### 4. Generate Key Takeaways
    - Distill 3-5 main learnings from the entire Q&A session
    - Focus on actionable insights, not just summaries
    - Format: "[Topic]: [Specific learning]"

    ### 5. Executive Summary
    - Write 2-3 sentences capturing the most important findings
    - Lead with the biggest insight or most surprising finding
    - Be concrete and specific, not generic

    {{ ctx.output_format }}
  "#
}

// Test case for Q&A extraction
test ExtractQAPairs_Basic {
  functions [ExtractQAPairs]
  args {
    evidence_json #"
    [
      {"id": "abc12345", "verbatim": "What tools do you currently use?", "is_question": true, "gist": "Question about tools"},
      {"id": "def67890", "verbatim": "We mainly use Notion for docs and Slack for communication", "is_question": false, "gist": "Uses Notion and Slack", "anchors": [{"start_ms": 45000}]},
      {"id": "ghi11111", "verbatim": "What's your biggest frustration with these tools?", "is_question": true, "gist": "Question about frustrations"},
      {"id": "jkl22222", "verbatim": "The biggest issue is that nothing is connected. I have to copy-paste between tools constantly.", "is_question": false, "gist": "Frustrated by disconnected tools", "anchors": [{"start_ms": 78000}]}
    ]
    "#
    interview_context "User research interview about productivity tools"
    focus_areas null
  }
}
