// ============================================================================
// Extract Evidence - Primary BAML Schema and Function
// ============================================================================
// Produces normalized evidence units from transcripts with timestamp anchors
// for precise media playback and auditability.
//
// Previous version (extract_evidence.baml with string-based Anchor class) has
// been deprecated in favor of this integer-based millisecond approach.
// ============================================================================

// === TurnAnchors: Standardized anchor format for transcript evidence ===
// Uses integer milliseconds for direct video/audio seeking
class TurnAnchors {
  start_ms int? @description("CRITICAL: Start time in milliseconds. Extract from transcript timestamps or chapter data. This is REQUIRED for video playback.")
  end_ms int? @description("End time in milliseconds when available")
  chapter_title string? @description("Optional chapter/section title")
  char_span int[]? @description("Optional [start,end] character offsets in transcript")
}

class EvidenceTurn {
  index int @description("0-based, contiguous, equals its position in evidence[]")
  person_key string @description("REQUIRED: Exact match to Person.person_key (e.g., 'participant-1', 'interviewer-1'). Must reference a person defined in the people array.")
  speaker_label string? @description("Literal transcript speaker label, e.g., 'SPEAKER A', 'Speaker B' or the provided diarization name")
  gist string @description("≤12-word essence of the turn; slide-like headline")
  chunk string @description("2–5 sentences capturing the person's full thought")
  verbatim string @description("≤15-word exact quote/snippet from the chunk")
  anchors TurnAnchors @description("Anchors to source for auditability")
  confidence string? @description("low | medium | high")
  why_it_matters string? @description("≤10 words on consequence/importance (e.g., trigger/impact; note if generalizable)")
	facet_mentions FacetMention[] @description("Facet mentions that appear in this turn")
  isQuestion bool? @description("TRUE if this turn contains a question (any speaker). Useful for filtering question-response patterns.")
  // Empathy maps (says/does/thinks/feels/pains/gains) removed from extraction pass for performance.
  // Reimplemented as paid-tier feature derived from facet_mentions. See bead Insights-vpws.
}

class FacetMention {
  parent_index int @description("EvidenceTurn.index this mention derives from")
  person_key string @description("REQUIRED: Exact match to Person.person_key. Must match the person_key of the parent EvidenceTurn.")
  kind_slug string @description("One: goal | pain | behavior | tool | value | requirements | preference | demographic | context | artifact | emotion | workflow | feature")
  value string @description("CRITICAL: Human-readable descriptive text (≤12 words), NOT an ID or reference number. Examples: 'Healthcare Professional', 'prefers explicit topic mapping for workflow', 'requires calendar integration to schedule study'. NEVER use formats like 'ID:123' or numeric references. Prefer verb+object or noun+modifier. Include trigger/condition and objective when helpful.")
  quote string? @description("Optional ≤15-word supporting quote from the parent turn")
  confidence float? @description("Discrete buckets recommended: 1, 0.75, 0.5, 0.25, 0")
}

class Scene {
  scene_id string @description("Stable id for the scene/segment")
  start_index int @description("First EvidenceTurn index in the scene")
  end_index int @description("Last EvidenceTurn index in the scene")
  topic string @description("Short topic label for the scene")
  summary string? @description("1–2 sentence summary of what the scene covers")
}

class Person {
  person_key string @description("REQUIRED: Deterministic slug like 'participant-1', 'participant-2', 'interviewer-1'. Number based on first appearance order. This MUST be used consistently in all EvidenceTurn and FacetMention references.")
  speaker_label string? @description("Literal transcript speaker label, e.g., 'SPEAKER A', 'Speaker B' or the provided diarization name")
	person_name string? @description("The person's common name when confidently known, like John Smith, Sally A., etc.")
	inferred_name string? @description("Preferred name if confidently inferred from context")
	job_title string? @description("Optional free-text title like 'Product Manager' when explicitly stated")
	job_function string? @description("Optional normalized job function like Engineering, Product, Sales, Marketing")
}

// === Interaction Context: What kind of conversation is this? ===
// LLM-determined classification for automatic lens selection
enum InteractionContext {
  Research @description("User research, customer discovery, interviews - exploring user needs and behaviors")
  Sales @description("Sales calls, demos, deal discussions, objection handling - revenue-focused conversations")
  Support @description("Support conversations, escalations, customer success check-ins - helping existing customers")
  Internal @description("Team meetings, internal debriefs, planning sessions - no external participants")
  Debrief @description("Voice memos, call recaps, field notes - quick capture of thoughts, decisions, and action items")
  Personal @description("Personal content, vlogs, non-business recordings - content about personal life or experiences")
}

class Extraction {
		//  people EvidenceParticipant[]
		 people Person[]
		 evidence EvidenceTurn[] @description("Chronological stream of evidence turns")
		 scenes Scene[]

	 // LLM-determined interaction context for automatic lens selection
	 interaction_context InteractionContext @description("What kind of conversation is this? Used for automatic lens selection.")
	 context_confidence float @description("0.0-1.0 confidence in the interaction_context classification")
	 context_reasoning string @description("Brief 1-2 sentence explanation of why this context was chosen")
}

class SpeakerUtterance {
  speaker string @description("Speaker label like 'SPEAKER A', 'SPEAKER B'")
  text string @description("The utterance text")
  start int? @description("Start time in milliseconds")
  end int? @description("End time in milliseconds")
}

// === Shared Support Classes ===

class Chapter {
  start_ms int @description("Chapter start time in milliseconds")
  end_ms int? @description("Chapter end time in milliseconds (optional)")
  summary string? @description("Brief summary of this chapter/section")
  title string? @description("Chapter or section title")
}

class FacetCatalogKind {
  slug string @description("Kind identifier, e.g., goal | pain | task | tool | value")
  label string @description("Display label for the kind")
}

class FacetCatalogEntry {
  facet_account_id int @description("Facet account ID (primary key from facet_account table)")
  kind_slug string @description("Kind slug this facet belongs to")
  label string @description("Preferred display label")
  alias string? @description("Project-level alias to show instead of label when present")
  synonyms string[]? @description("Known synonyms and aliases")
}

class FacetCatalog {
  kinds FacetCatalogKind[] @description("Merged catalog of facet kinds (project ▶ account ▶ global)")
  facets FacetCatalogEntry[] @description("Merged facet entries available to this project")
  version string @description("Opaque version string for caching and diffing")
}

function ExtractEvidenceFromTranscriptV2(
  speaker_transcripts: SpeakerUtterance[],
  chapters: Chapter[],
  language: string
) -> Extraction {
  client "EvidenceExtractionFast"
  prompt #"
You are an expert UX researcher.
Your task is to produce an exhaustive, chronological Event Stream from an conversation transcript so the reader can follow what happened moment by moment, with explicit mention-level signals. Do not summarize; capture every distinct signal as a separate mention.
Note this could be a monologue in which case be sure to create evidenceTurns for each separate topic.

## Steps
1. Identify every human speaker. Populate the `people` array once with:
   - `person_key`: deterministic slug per human such as `participant-1`, `participant-2`, `interviewer-1`. Derive the number from first appearance order. Reuse the EXACT same `person_key` string for all references to that person. Never reuse a slug for different humans.
   - `speaker_label`: the literal transcript label (e.g., "SPEAKER 2", "Kai", "Interviewer").
   - `inferred_name`, `job_title`, and `job_function` when confident.
2. Slice the transcript into coherent, chronological turns (where each turn is a single speaker). Emit one `EvidenceTurn` per turn, anchored to the correct `person_key` with gist, chunk, verbatim, anchors, and facet mentions.
3. For each `EvidenceTurn`, emit one or more `FacetMention` items—one per distinct, atomic signal (goal, pain, behavior, tool, value, preference, demographic, context, artifact, emotion, feature, price). Each `FacetMention` must reference its parent `EvidenceTurn` via `parent_index`. Keep `value` concrete and readable in isolation (≤12 words). Prefer verb+object or noun+modifier. Avoid vague superlatives (e.g., "best", "amazing") unless paired with a criterion. Include a short `quote` when high-signal.
4. Segment the conversation into `Scene`s when the topic/goal shifts. Each scene spans a contiguous block of `EvidenceTurn.index` values and has a short topic label.

## Selection Priorities
High-severity pains, frequent/recency-marked behaviors, explicit goals, success criteria.
Workarounds, hacks, switching triggers, evaluation criteria, blockers, willingness-to-pay signals.
Moments that reveal motivations, anxieties, decision criteria, or definitions of success.

## SKIP Non-Evidence (Do NOT Extract)
- Weather talk, bathroom breaks, technical difficulties
- Social pleasantries ("nice to meet you", "how are you", "have a great day")
- Procedural questions ("can we continue?", "is this recording?", "can you hear me?")
- Off-topic chitchat unrelated to product, workflow, or user psychology
- Interviewer instructions or transitions unless they reveal user confusion/friction

Examples to SKIP:
❌ "It's really hot today" - weather
❌ "Can I grab some water real quick?" - procedural
❌ "That's fine, go ahead" - generic acknowledgment
❌ "So, let's talk about..." - interviewer transition (no signal)

Examples to EXTRACT:
✅ "I wish the tool would..." - pain/goal
✅ "I usually work around that by..." - workaround/behavior
✅ "It's frustrating when..." - pain with emotional signal
✅ "I use Notion because..." - tool + rationale

ONLY extract turns with business or psychographic relevance.

## EvidenceTurn
- index: 0-based chronological index (strictly ascending) and equals its position in the stream.
- **person_key**: REQUIRED. Exact match (character-for-character) to the `person_key` defined for that person in `people`. Never invent a new slug at the turn level. CRITICAL: Distinguish between interviewer and participant - if someone is asking questions, they're likely the interviewer; if answering, they're the participant.
- gist: ≤12 words; no labels like "Quote:".
- chunk: 2–5 sentences of the participant’s words.
- verbatim: ≤15-word quote from the chunk.
- **anchors.start_ms**: CRITICAL - ALWAYS use the `start` field from the corresponding SpeakerUtterance. This timing is already in milliseconds and is REQUIRED for video playback functionality.
- anchors: include start_ms (REQUIRED), end_ms when available, speaker label, optional chapter_title.
- confidence: low | medium | high. Map evidence strength: direct quote ≥ concrete behavior ≥ inferred belief.
- **isQuestion**: Set to TRUE if this turn contains any question (explicit questions, requests for clarification, probes, etc.) regardless of speaker. FALSE or omit if no questions. Useful for filtering question-response patterns and conversation analysis.
- why_it_matters: ≤10 words; express the consequence or importance (e.g., "blocks timely status updates").

## FacetMention (extraction-only, no linking)
- parent_index: points to the `EvidenceTurn.index` where the signal appeared.
- **person_key**: REQUIRED. Must match the exact slug from `people` AND match the person_key of the parent EvidenceTurn. CRITICAL: Assign facets to the person who EXPRESSED the trait/behavior, not the person being discussed. If the interviewer asks "What tools do you use?", the participant's answer creates facets for the PARTICIPANT, not the interviewer.
- kind_slug: one of goal | pain | behavior | tool | value | workflow | preference | demographic | context | artifact | emotion | feature.
- value: concrete, atomic (≤12 words). Prefer verb+object or noun+modifier. Include frequency/recency when stated (e.g., "daily", "last week"). Include trigger/condition and objective when helpful. For preference/value, compress subject + rationale into one field when possible: e.g., "values integrated planning + calendar (tracks progress)", "prefers explicit topic mapping for workflow", "requires calendar integration to schedule study".
- quote: include when it strengthens auditability; ≤15 words.
- confidence: one of 1, 0.75, 0.5, 0.25, 0.
- Output one FacetMention per distinct signal in a turn; do not merge similar mentions across turns.

## Scenes
- Create a new scene when the topic/goal shifts meaningfully.
- Each scene has `start_index`, `end_index`, and a short `topic` label.

## Interaction Context Classification
Determine the `interaction_context` for this conversation. This is used for automatic lens selection.
- **Research**: User research, customer discovery interviews - exploring user needs, behaviors, pain points. Look for: open-ended questions, exploration of workflows, understanding motivations.
- **Sales**: Sales calls, demos, deal discussions - revenue-focused. Look for: pricing discussions, feature requirements, objection handling, deal stages, competition mentions.
- **Support**: Support conversations, escalations, customer success - helping existing customers. Look for: bug reports, how-to questions, account issues, renewal discussions.
- **Internal**: Team meetings, debriefs, planning - no external participants. Look for: all speakers from same organization, strategy discussions, project planning.
- **Personal**: Solo voice memos, reflections - single speaker capturing thoughts. Look for: single speaker, stream of consciousness, personal goals/reflections.

Consider:
- Number of speakers and their roles (single speaker = likely personal)
- Topics discussed (deals/pricing = sales, bugs/issues = support, user needs = research)
- Presence of external customers/users vs internal team only
- Tone and question style (exploratory vs transactional)

Set `context_confidence` between 0.0-1.0 based on how clear the signals are.

## Guardrails
- Emit all items in ascending `index` / `parent_index` order.
- Do not fall back to a generic person — if a turn's `person_key` cannot be matched to `people`, revisit your mapping rather than defaulting to the primary participant.
- Do not output any catalog ids or proposals; linking occurs in a separate step.
- Keep `value` and `verbatim` within word limits. Ban vague comparatives unless paired with a concrete subject/rationale. Each mention should be testable and specific (avoid grouping multiple subjects; emit one mention per subject).
- Prefer fewer, higher-quality turns over many weak ones; but do not drop distinct signals (emit mentions instead).
- ALWAYS output `interaction_context`, `context_confidence`, and `context_reasoning` at the top level.

Speaker Transcripts (language={{ language }})
Each utterance includes speaker label, text, and timing in milliseconds:
{{ speaker_transcripts }}

Chapters (optional; may help anchoring)
{{ chapters }}

Output ONLY JSON conforming to {{ ctx.output_format }} (no prose/markdown). Ensure indices are contiguous from 0 and strictly ascending; each FacetMention.parent_index references an existing EvidenceTurn.index; omit empty/null fields.
"#
}

// Basic extraction test
test ExtractEvidenceFromTranscriptV2_BasicTest {
  functions [ExtractEvidenceFromTranscriptV2]
  args {
    speaker_transcripts [
      {
        speaker "INTERVIEWER"
        text "How do you feel about your current project management tool?"
        start 0
        end 5000
      },
      {
        speaker "PARTICIPANT"
        text "Honestly, it's really frustrating. I spend way too much time just trying to find where I put things. Like, I'll create a task and then I can't remember which project I assigned it to. It makes me feel disorganized and stressed out."
        start 5500
        end 20000
      },
      {
        speaker "INTERVIEWER"
        text "What do you do when that happens?"
        start 20500
        end 23000
      },
      {
        speaker "PARTICIPANT"
        text "I usually end up searching through every project folder, which takes forever. Sometimes I just give up and create a duplicate task. I know it's not efficient, but I need to get my work done. I really wish there was a better way to organize everything automatically."
        start 23500
        end 40000
      },
      {
        speaker "INTERVIEWER"
        text "What would success look like for you?"
        start 40500
        end 43000
      },
      {
        speaker "PARTICIPANT"
        text "I want to feel confident that I can find anything I need within seconds. When I'm in a meeting and someone asks about a project status, I want to pull it up instantly instead of saying 'let me get back to you on that.' That would make me feel so much more professional and in control."
        start 43500
        end 60000
      }
    ]
    chapters []
    language "en"
  }
}
