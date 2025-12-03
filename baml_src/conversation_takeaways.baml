// High-level conversation value assessment across all lenses

class ConversationTakeaways {
  value_synopsis string @description("1-2 sentences: How valuable was this conversation overall? What made it uniquely powerful or inline supportive?")
  critical_next_step string @description("1 sentence: The single most important next step or caution based on all perspectives")
  future_improvement string @description("1 sentence: What could be improved on future calls")
}

function ExtractConversationTakeaways(
  transcript: string,
  bant_summary: string?,
  meddic_summary: string?,
  stakeholders_summary: string?,
  empathy_insights: string?,
  evidence_count: int,
  duration_minutes: int?
) -> ConversationTakeaways {
  client CustomGPT4o
  prompt #"
    You are an expert conversation analyst. Synthesize the value of this conversation across multiple perspectives.

    Interview Duration: {{ duration_minutes }} minutes
    Evidence Items: {{ evidence_count }}

    Transcript:
    {{ transcript }}

    {% if bant_summary %}
    BANT/GPCT Analysis:
    {{ bant_summary }}
    {% endif %}

    {% if meddic_summary %}
    MEDDIC Analysis:
    {{ meddic_summary }}
    {% endif %}

    {% if stakeholders_summary %}
    Stakeholders Identified:
    {{ stakeholders_summary }}
    {% endif %}

    {% if empathy_insights %}
    Empathy Map Insights:
    {{ empathy_insights }}
    {% endif %}

    Provide a concise executive summary in exactly 3-4 sentences total:
    1. Value Synopsis: How valuable was this conversation? What made it uniquely powerful, inline supportive, or noteworthy across the various perspectives (BANT, MEDDIC, stakeholders, empathy)?
    2. Critical Next Step: What is the single most important next step or caution based on all perspectives?
    3. Future Improvement: What could be improved on future calls to extract more value?

    Keep each point to 1 sentence. Be direct and actionable.
  "#
}
