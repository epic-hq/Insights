class Persona1 {
  // Demographics
  name string @description("Persona name: up to 3 words")
  description string | null @description("Persona Archetype description: 3-7 sentences summarizing behavior, pain, motivations, and preferences")
  age string | null @description("Most common age or age range, e.g. '25-34'")
  gender string | null @description("Most common gender for this persona")
  location string | null @description("Most common location(s) for this persona")
  education string | null @description("Most common education level(s)")
  occupation string | null @description("Most common occupation(s)")
  income string | null @description("Most common income range or level")
  languages string | null @description("Most common languages spoken")
  segment string | null @description("Segment or group this persona belongs to")
  role string | null @description("Role or job title")
  color_hex string | null @description("Hex color for persona visualization")
  image_url string | null @description("URL to persona avatar/profile image")

  // Psychographics
  motivations string[] | null @description("Key motivations for this persona")
  values string[] | null @description("Core values for this persona")
  frustrations string[] | null @description("Top frustrations or pain points")
  preferences string | null @description("Notable preferences")
  learning_style string | null @description("Preferred learning style")
  tech_comfort_level string | null @description("Comfort level with technology")

  // Behavior
  frequency_of_purchase string | null @description("How often this persona purchases relevant products/services")
  frequency_of_use string | null @description("How often this persona uses relevant products/services")
  key_tasks string[] | null @description("Key tasks this persona performs")
  tools_used string[] | null @description("Tools or products commonly used by this persona")
  primary_goal string | null @description("Primary goal for this persona")
  secondary_goals string[] | null @description("Secondary goals for this persona")
  sources string[] | null @description("Main sources of information or influence")
  quotes string[] | null @description("Representative quotes from this persona")
  percentage float | null @description("Estimated percentage of users represented by this persona")
}

// baml_src/personas.baml
// Rolling persona refinement with single‑interview safeguards

class Persona {
  // === IDENTITY & CORE ===
  name string @description("Persona name: up to 4 words. Plain, memorable, captures essence. Example: The Reluctant Power User, Last-minute shopper")
  name_and_tagline string @description("2–4 words + optional quoted tagline. Plain, memorable, captures essence. Example: The Reluctant Power User — 'Wants outcomes, hates setup'.")
  description string | null @description("Persona Archetype description: 3-7 sentences summarizing behavior, pain, motivations, and preferences")
  role_context string @description("Role/life stage/situation as it relates to the product problem. Example: 'HS junior juggling AP classes' or 'Ops lead at 20‑person startup'.")

  // === DEMOGRAPHICS ===
  age string | null @description("Most common age or age range, e.g. '25-34'")
  gender string | null @description("Most common gender for this persona")
  location string | null @description("Most common location(s) for this persona")
  education string | null @description("Most common education level(s)")
  occupation string | null @description("Most common occupation(s)")
  income string | null @description("Most common income range or level")
  languages string | null @description("Most common languages spoken")
  segment string | null @description("Segment or group this persona belongs to")
  role string | null @description("Role or job title")

  // === VISUAL IDENTITY ===
  color_hex string | null @description("Hex color for persona visualization")
  image_url string | null @description("URL to persona avatar/profile image")
  percentage float | null @description("Estimated percentage of users represented by this persona")

  // === GOALS & MOTIVATIONS ===
  goals string[] @description("3–5 user outcomes (not features). Example: 'Finish assignments faster'; 'Reduce rework'.")
  primary_goal string | null @description("Primary goal for this persona")
  secondary_goals string[] | null @description("Secondary goals for this persona")
  motivations string[] | null @description("Key motivations for this persona")
  values string[] | null @description("Core values for this persona")
  success_definition string @description("Crisp success statement in this domain. Example: 'Submits work a day early without anxiety'.")

  // === BEHAVIORS & PATTERNS ===
  behaviors_habits string[] @description("Observable patterns (work/learn/decide/communicate) + tools/channels/frequency. Keep concrete & falsifiable. Example: 'Checks app daily; prefers SMS'.")
  key_tasks string[] | null @description("Key tasks this persona performs")
  tools_used string[] | null @description("Tools or products commonly used by this persona")
  frequency_of_purchase string | null @description("How often this persona purchases relevant products/services")
  frequency_of_use string | null @description("How often this persona uses relevant products/services")
  triggers_decision_drivers string[] @description("What causes action + how choices are made. Example: 'Deadline pressure; peer proof'.")

  // === PAIN POINTS & CHALLENGES ===
  pain_points string[] @description("Top 3–5 blockers or unmet needs that are actionable for product/design. Example: 'Lack of visibility'; 'Difficulty with setup'.")
  frustrations string[] | null @description("Top frustrations or pain points")

  // === PREFERENCES & STYLE ===
  preferences string | null @description("Notable preferences")
  learning_style string | null @description("Preferred learning style")
  tech_comfort_level string | null @description("Comfort level with technology")

  // === EVIDENCE & INSIGHTS ===
  key_quotes string[] @description("1–3 verbatim interview quotes (lightly cleaned). Real language only.")
  sources string[] | null @description("Main sources of information or influence")
  differentiators string[]
    @description("≥3 concrete, behavior/motivation‑based ways this persona differs from others.")
    @assert(min_three_diffs, {{ this|length >= 3 }})

  // === RESEARCH METADATA ===
  confidence string @description("Overall confidence: use one of 'Low', 'Medium', 'High'. If evidence_count < 2, MUST be 'Low'.")
  evidence_count int @description("Distinct interviews supporting this persona. Usually 1 in single‑interview mode.")
  hypothesis_notes string @description("Brief, falsifiable assumptions awaiting validation. Do not restate facts.")
  key_open_questions string[] @description("3–5 questions that would confirm/refute this persona in the next interview.")
}

class PersonaSet {
  personas Persona[]
    @description("Prefer 3–5 active personas; never exceed 5 without explicit authorization.")
    @assert(cap_5, {{ this|length <= 5 }})

  version string @description("Version vX.Y: X=merges/splits/framework changes; Y=incremental tweaks.")

  change_log string @description("What changed & why: added/removed/merged personas; major field edits; cite evidence counts (e.g., '≥2 interviews').")

  // When any persona has evidence_count < 2, produce a single contrast persona to probe next.
  contrast_persona Persona? @description("A deliberately different, testable counter‑hypothesis at the opposite end of the salient spectrum. Required if any persona has evidence_count < 2.")
}


//// Pass 0 — Ingest & Normalize

class NoteSnippet {
  tag string @description("One of: FACT | QUOTE | GOAL | PAIN | BEHAVIOR | TRIGGER | SUCCESS | IRRELEVANT")
  text string @description("Cleaned snippet text; QUOTE must be verbatim with minor fixes only.")
  speaker string? @description("Optional speaker label (e.g., 'User', 'Interviewer', name).")
  timestamp string? @description("Optional timestamp from source, e.g., '00:13:21'.")
}

class InterviewDoc {
  source string @description("Brief identifier for the interview (file, session id, or date).")
  snippets NoteSnippet[] @description("Structured, de‑duplicated snippets. Exclude pleasantries and off‑topic content.")
}

function NormalizeNotes(raw_notes: string) -> InterviewDoc {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    Normalize raw interview notes into labeled, concise snippets for UX research.

    Rules:
    - Keep only domain-relevant content.
    - Label each snippet with one of: FACT | QUOTE | GOAL | PAIN | BEHAVIOR | TRIGGER | SUCCESS | IRRELEVANT.
    - QUOTE must be verbatim (light punctuation/grammar fixes allowed).
    - Merge duplicates; prefer the strongest phrasing.
    - Preserve any timestamps/speakers if present in the text.
    - Exclude IRRELEVANT snippets from the final output.

    {{ _.role("user") }}
    RAW_NOTES:
    {{ raw_notes }}

    Produce {{ ctx.output_format }} with snippets excluding IRRELEVANT.
  "#
}

//// Pass 1 — Evidence Extract (no synthesis)

class EvidenceSet {
  facts string[] @description("Objective observations derived from FACT and BEHAVIOR.")
  goals string[] @description("User outcomes from GOAL only; no features.")
  pains string[] @description("Actionable problems from PAIN.")
  behaviors string[] @description("Observable patterns/tools/frequency from BEHAVIOR.")
  triggers string[] @description("Action triggers + choice drivers from TRIGGER.")
  success string[] @description("Definitions of success from SUCCESS.")
  quotes string[] @description("1–5 verbatim quotes representative of the above.")
}

function ExtractEvidence(doc: InterviewDoc) -> EvidenceSet {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    Extract only verifiable evidence from a normalized interview doc.
    Do NOT invent or generalize beyond provided snippets.

    Rules:
    - Each output item must map to one or more input snippets.
    - Use QUOTE text verbatim (light cleanup allowed).
    - Ignore demographics unless causally tied to use/decisions.
    - Prefer fewer, stronger items over many weak ones.

    {{ _.role("user") }}
    INTERVIEW_DOC:
    {{ doc }}

    Return {{ ctx.output_format }}.
  "#
}

//// Pass 2 — Spectrum Detection

class Spectrum {
  axis string @description("Primary axis of variation to test next, formatted as 'X ↔ Y', e.g., 'Autonomy ↔ Guidance'.")
  rationale string @description("Why this axis matters for product decisions (onboarding, content, help, messaging).")
  supporting_evidence string[] @description("Bullets referencing facts/quotes that point to this axis.")
  alternatives string[] @description("Up to 2 runner-up axes considered (same 'X ↔ Y' format) with a 1‑line reason each.")
}

function FindSpectrum(evidence: EvidenceSet) -> Spectrum {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    Select the strongest behavioral/motivational spectrum to anchor a contrast persona.

    Candidate axes (examples; choose the most decision-impacting):
    - Autonomy ↔ Guidance
    - Planner ↔ Sprinter
    - Depth ↔ Speed
    - Social proof ↔ Solo
    - Exploration ↔ Checklists

    Rules:
    - Pick ONE primary axis that most changes the product/design choices now.
    - Provide concise rationale and cite the most relevant evidence items.
    - List up to 2 alternatives only if close contenders.

    {{ _.role("user") }}
    EVIDENCE_SET:
    {{ evidence }}

    Return {{ ctx.output_format }} with a single primary axis.
  "#
}

//// Pass 3 — Draft Provisional Persona (N=1 discipline)

function DraftProvisionalPersona(evidence: EvidenceSet, spectrum: Spectrum) -> Persona {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    Draft a provisional persona from evidence only (no invention).
    Single‑interview discipline: confidence must be "Low" and evidence_count = 1.

    Rules:
    - Populate fields ONLY with content grounded in the EvidenceSet (facts, goals, pains, behaviors, triggers, success, quotes).
    - Use 1–3 verbatim quotes (light cleanup allowed). If none fit, leave key_quotes empty.
    - Provide ≥3 differentiators (behavior/motivation‑based), tied to the chosen spectrum: {{ spectrum.axis }}.
    - Do NOT include demographics unless causally relevant to use/decisions.
    - Fill hypothesis_notes with crisp, falsifiable assumptions (what you would expect to hold if this persona is real).
    - Provide 3–5 key_open_questions that will confirm/refute this persona next interview.
    - Set confidence = "Low" and evidence_count = 1.

    {{ _.role("user") }}
    EVIDENCE_SET:
    {{ evidence }}

    PRIMARY_SPECTRUM:
    {{ spectrum }}

    Produce {{ ctx.output_format }}.
  "#
}

//// Pass 4 — Draft Contrast Persona (counter‑hypothesis at opposite spectrum end)

function DraftContrastPersona(provisional: Persona, spectrum: Spectrum) -> Persona {
  client "openai/gpt-4o-mini"
  prompt #"
    {{ _.role("system") }}
    Create ONE contrast persona positioned at the opposite end of the primary spectrum.
    This is a counter‑hypothesis used to disambiguate in the next interview.

    Rules:
    - Place this persona at the OPPOSITE end of {{ spectrum.axis }} relative to the provisional persona.
    - Provide ≥3 differentiators that DO NOT overlap with the provisional’s differentiators.
    - Keep it lean: include only fields necessary to design a test (but return a valid Persona object).
    - Do NOT invent quotes; key_quotes can be empty.
    - Set confidence = "Low" and evidence_count = 1.
    - key_open_questions should focus on disambiguating THIS contrast from the provisional.

    {{ _.role("user") }}
    PROVISIONAL_PERSONA:
    {{ provisional }}

    PRIMARY_SPECTRUM:
    {{ spectrum }}

    Produce {{ ctx.output_format }}.
  "#
}


function RefinePersonas(existing_persona_set: PersonaSet, new_interview_notes: string) -> PersonaSet {
  client "openai/gpt-5-mini"

  prompt #"
    {{ _.role("system") }}
    You are a UX researcher updating a living persona set from new interview notes.
    Return ONLY a valid PersonaSet JSON per the schema; no extra commentary.

    Hard rules:
    1) Evidence threshold: Add/change traits only if supported by ≥2 independent interview findings.
    2) Max differentiation: Each persona must include ≥3 behavior/motivation differentiators.
    3) Merge overlap: If two personas share >70% core needs/motivations, MERGE and keep strongest diffs.
    4) Count cap: Keep ≤5 personas unless explicitly authorized.
    5) Spectrum strategy: When patterns form a continuum (e.g., DIY ↔ Guided), place personas at distinct ends; add one middle only if necessary.
    6) Demographics: Include only when they causally affect use/decisions; otherwise omit.
    7) Actionability filter: Omit details that won’t change product, design, or messaging decisions.
    8) Versioning: Bump version (vX.Y). Major bump (X) for merges/splits/framework changes; minor bump (Y) for incremental tweaks.
    9) Change log: Summarize additions/removals/merges and key edits with brief evidence references (e.g., “3/5 interviews mention …”).

    Single‑interview mode:
    - If any resulting persona has evidence_count < 2:
      * Set confidence="Low" for that persona.
      * Provide exactly one contrast_persona at the opposite end of the primary behavioral/motivational spectrum.
      * Populate hypothesis_notes with crisp, falsifiable assumptions.
      * Provide 3–5 key_open_questions to disambiguate in the next interview.
      * Prefer leaving fields empty over guessing beyond notes/first‑party telemetry.

    {{ _.role("user") }}
    CURRENT_SET:
    {{ existing_persona_set }}

    NEW_INTERVIEW_NOTES:
    {{ new_interview_notes }}

    Produce the updated persona set strictly as per the schema below.

    {{ ctx.output_format }}
  "#
}


function ExtractPersona(people: string, insights: string, interviews: string) -> Persona {
  client "CustomGPT5Mini"
  prompt #"
    You are an expert UX researcher. Given the following people records and their insights, generate a detailed persona profile.

    1. Create a UX persona that represents the people records and insights.
       - Use up to 3 words for a catchy name.
       - Write a 3-7 sentence description summarizing behavior, pain, motivations, and preferences.
    2. For each of the following fields, aggregate and summarize the most common or representative value(s) from the data:
       - age, gender, location, education, occupation, income, languages, segment, role, color_hex, image_url
       - motivations, values, frustrations, preferences, learning_style, tech_comfort_level
       - frequency_of_purchase, frequency_of_use, key_tasks, tools_used, primary_goal, secondary_goals, sources, quotes, percentage
    3. For array fields, provide 2-5 representative items. For string fields, provide the most common or relevant value.
    4. Use direct quotes from the data where possible for the 'quotes' field.
    5. If a field is not present in the data, return null.

		Interview records:
		{{ interviews }}

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}

function GeneratePersonas(interviews: string, people: string, insights: string) -> Persona[] {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher and strategist. Below are a mixture of transcribed conversations, interviews, notes, and insights.
		Your task is to generate 4 personas based on the data.

		1. Find each distinct persona in the data, summarizing each as a Persona object in a descriptive manner to help us identify other people like them.
    - For each persona, fill out all fields in the Persona schema, using the most representative or common values.
    - For array fields, provide 2-5 representative items. For string fields, provide the most common or relevant value.
    - Use direct quotes from the data where possible for the 'quotes' field.
    - If a field is not present in the data, return null.

    2. Generate a up to 3 additional personas that are not present but would be expected in this context, based on gaps or patterns in the data. Mark these as 'projected' in the description.

		Do not group people into personas that are too different from each other.

		DO Not generate personas that are too similar to each other.

    People records:
    {{ people }}

    Insights:
    {{ insights }}

    Output format:
    {{ ctx.output_format }}
  "#
}

// New intelligent persona assignment decision
class PersonaAssignmentDecision {
  action string @description("Either 'assign_existing' or 'create_new'")
  persona_id string | null @description("ID of existing persona if action is 'assign_existing', null if creating new")
  persona_name string | null @description("Name of existing persona if assigning, or proposed name for new persona")
  confidence_score float @description("Confidence in this decision from 0.0 to 1.0")
  reasoning string @description("Detailed explanation of why this decision was made")
  new_persona_data Persona | null @description("Complete persona data if action is 'create_new', null otherwise")
}

function AssignPersonaToInterview(
  interview_transcript: string,
  interviewee_info: string,
  existing_personas: string
) -> PersonaAssignmentDecision {
  client "CustomGPT4oMini"
  prompt #"
    You are an expert UX researcher tasked with intelligently assigning an interview participant to either an existing persona or creating a new one.

    DECISION CRITERIA:
    1. ASSIGN TO EXISTING if the interviewee shows >70% alignment with an existing persona in:
       - Core motivations and goals
       - Key behaviors and patterns
       - Primary pain points and frustrations
       - Decision-making triggers
       - Tech comfort level and preferences

    2. CREATE NEW if the interviewee represents a distinct archetype that:
       - Has fundamentally different motivations or goals
       - Shows unique behavioral patterns not captured by existing personas
       - Has different pain points or success definitions
       - Represents a new segment or user type

    ANALYSIS PROCESS:
    1. Extract key characteristics from the interview transcript and interviewee info
    2. Compare against each existing persona systematically
    3. Calculate alignment percentage for each existing persona
    4. If highest alignment is >70%, assign to that persona
    5. If all alignments are <70%, create a new persona

    INTERVIEW TRANSCRIPT:
    {{ interview_transcript }}

    INTERVIEWEE INFO:
    {{ interviewee_info }}

    EXISTING PERSONAS:
    {{ existing_personas }}

    Return a PersonaAssignmentDecision with:
    - Clear action (assign_existing or create_new)
    - Persona ID/name if assigning to existing
    - Confidence score (0.0-1.0)
    - Detailed reasoning for the decision
    - Complete new persona data if creating new (following the Persona schema)

    {{ ctx.output_format }}
  "#
}
