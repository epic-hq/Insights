// High-level conversation value assessment across all lenses

class ConversationEvidence {
  id string @description("Evidence UUID for linking back")
  verbatim string @description("Exact quote from the conversation")
  gist string? @description("AI-generated summary of the evidence")
  speaker string? @description("Who said this")
  evidence_type string? @description("Type of evidence: pain_point, desire, commitment, etc.")
  timestamp_start float? @description("When this was said in the conversation (seconds)")
}

class ConversationTakeaways {
  value_synopsis string @description("1-2 sentences: How valuable was this conversation overall? What made it uniquely powerful or inline supportive?")
  critical_next_step string @description("1 sentence: The single most important next step or caution based on all perspectives")
  future_improvement string @description("1 sentence: What could be improved on future calls")
  supporting_evidence_ids string[] @description("IDs of evidence items that most strongly support these takeaways")
}

function ExtractConversationTakeaways(
  evidence: ConversationEvidence[],
  bant_summary: string?,
  meddic_summary: string?,
  stakeholders_summary: string?,
  duration_minutes: int?
) -> ConversationTakeaways {
  client CustomGPT4o
  prompt #"
    You are an expert conversation analyst. Synthesize the value of this conversation based on key evidence and framework analyses.

    Interview Duration: {{ duration_minutes }} minutes
    Evidence Items Captured: {{ evidence | length }}

    ## Key Evidence from Conversation
    {% for item in evidence %}
    ---
    Evidence #{{ loop.index }} (ID: {{ item.id | truncate(8) }})
    {% if item.speaker %}Speaker: {{ item.speaker }}{% endif %}
    {% if item.timestamp_start %}Time: {{ item.timestamp_start | round }}s{% endif %}
    {% if item.evidence_type %}Type: {{ item.evidence_type }}{% endif %}

    Quote: "{{ item.verbatim }}"
    {% if item.gist %}Summary: {{ item.gist }}{% endif %}
    {% endfor %}

    {% if bant_summary %}
    ## BANT/GPCT Analysis
    {{ bant_summary }}
    {% endif %}

    {% if meddic_summary %}
    ## MEDDIC Analysis
    {{ meddic_summary }}
    {% endif %}

    {% if stakeholders_summary %}
    ## Stakeholders Identified
    {{ stakeholders_summary }}
    {% endif %}

    ## Your Task
    Provide a concise executive summary in exactly 3 sentences:

    1. **Value Synopsis** (1-2 sentences): How valuable was this conversation? What made it uniquely powerful, inline supportive, or noteworthy? Reference specific evidence by mentioning what was discussed.

    2. **Critical Next Step** (1 sentence): What is the single most important next step or caution based on the evidence and framework analyses? Be specific about commitments or needs identified.

    3. **Future Improvement** (1 sentence): What could be improved on future calls to extract more value or address gaps?

    Additionally, identify the 3-5 most important evidence items (by ID prefix shown above) that best support your takeaways. These should be the "smoking gun" moments that justify your analysis.

    Be direct, actionable, and grounded in the actual evidence provided.
  "#
}
