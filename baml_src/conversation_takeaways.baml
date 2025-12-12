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
  value_synopsis string @description("2-3 bullet-style fragments on conversation value. Lead with specifics; zero corporate fluff.")
  critical_next_step string @description("1 punchy bullet with the single most important next step or caution; concrete owner/time/cue when possible.")
  future_improvement string @description("1 punchy bullet on what to do (differently) in future; tactical, not generic.")
  supporting_evidence_ids string[] @description("IDs of evidence items that most strongly support these takeaways")
}

function ExtractConversationTakeaways(
  evidence: ConversationEvidence[],
  bant_summary: string?,
  meddic_summary: string?,
  stakeholders_summary: string?,
  duration_minutes: int?,
  custom_instructions: string?
) -> ConversationTakeaways {
  client CustomGPT4o
  prompt #"
    You are analyzing this conversation to assess its value and identify next steps.

    Interview Duration: {{ duration_minutes }} minutes
    Evidence Items: {{ evidence | length }}

    ## Evidence from Conversation
    {% for item in evidence %}
    ---
    ID: {{ item.id[:8] }}
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

    ## Task
    {% if custom_instructions %}
    **IMPORTANT: Custom analysis instructions have been provided. Follow these instructions while still returning the required JSON structure:**

    {{ custom_instructions }}

    You MUST still return valid JSON with the required fields below, but adapt the content, tone, language, and focus according to the custom instructions above.
    {% endif %}

    Provide a practical business assessment with sharp, scannable phrasing. Style rules:
    - No corporate filler or soft adjectives; use plain, tactical language.
    - Use dash bullets and bold-ish prefixes inside the strings (e.g., "- Value: ...", "- Next: ...", "- Improve: ...").
    - Keep each fragment under ~20 words and call out concrete topics, decisions, or blockers.

    Return JSON with these fields:

    {
      "value_synopsis": "- Value: <2-3 terse bullets/lines on what mattered, named topics and decisions, no fluff>",
      "critical_next_step": "- Next: <single decisive action with owner or timing if known>",
      "future_improvement": "- Improve: <single change to make the next call stronger>",
      "supporting_evidence_ids": ["id1", "id2", "id3"]
    }

    For supporting_evidence_ids, include 3-5 evidence IDs from above (8-character prefixes like "156715a5"). Pick the most impactful quotes that support your assessment.

    Write in clear, practical business language. Reference what was discussed, not evidence numbers.
  "#
}
