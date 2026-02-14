// Standalone conversation analyzer schema

class ConversationQuestion {
  question string
  asked_by string?
  intent string?
  evidence_snippet string?
  confidence float
}

class ParticipantGoal {
  speaker string?
  goal string
  evidence_snippet string?
  confidence float
}

class ConversationTakeaway {
  priority "high" | "medium" | "low"
  summary string
  evidence_snippets string[]
}

class ConversationRecommendation {
  focus_area string
  action string
  rationale string
}

class ConversationAnalysis {
  overview string
  duration_estimate string?
  questions ConversationQuestion[]
  participant_goals ParticipantGoal[]
  key_takeaways ConversationTakeaway[]
  open_questions string[]
  recommended_next_steps ConversationRecommendation[]
}

function AnalyzeStandaloneConversation(
  transcript: string,
  context: string
) -> ConversationAnalysis {
  client CustomGPT4o
  prompt #"
    You are an expert conversation analyst helping revenue teams understand standalone call recordings.

    Transcript:
    {{ transcript }}

    Context (may be empty):
    {{ context }}

    Produce a structured analysis that:
      1. Identifies the explicit questions asked, who asked them, and the underlying intent.
      2. Infers each participant's goals or objectives from their statements.
      3. Summarizes the key takeaways that matter for sales or discovery follow-up, citing short evidence snippets.
      4. Highlights open questions or missing information that should be resolved next.
      5. Recommends next steps that keep the deal or relationship moving forward.

    Requirements:
      - Keep evidence snippets under 200 characters. Use exact quotes when possible.
      - Confidence scores must be between 0 and 1.
      - Never hallucinate participants not present in the transcript.
      - If intent or speaker cannot be determined, leave the optional fields null.
      - Maintain a concise but actionable overview paragraph for executives.

    {{ ctx.output_format }}
  "#
}
