// Derive Persona Facets BAML Schema and Function
// Phase 2: Synthesizes enduring persona traits from raw evidence

class PersonaFacet {
  person_key string @description("Reference to person from extraction")
  kind_slug string @description("One: motivation | value | attitude | skill | preference | personality | identity | belief | habit | constraint")
  value string @description("≤12 words; enduring trait phrasing. E.g., 'values autonomy in work', 'prefers visual learning over text', 'motivated by social impact'")
  evidence_refs int[] @description("List of FacetMention.index values supporting this trait")
  confidence float @description("0-1; based on frequency, consistency, and salience")
  frequency int @description("Number of distinct supporting mentions")
  reasoning string? @description("≤20 words explaining why this is an enduring trait vs situational")
}

class PersonaExtraction {
  persona_facets PersonaFacet[] @description("Enduring traits for each person")
  summary string? @description("1-2 sentence synthesis of persona patterns across all participants")
}

function DerivePersonaFacetsFromEvidence(
  extraction: Extraction
) -> PersonaExtraction {
  client "CustomGPT5"
  prompt #"
You are a research analyst synthesizing persona insights from structured evidence.

## Task
Given evidence turns and facet mentions, infer **enduring persona facets** for each participant.

## Steps
1. **Group by person**: Cluster all FacetMention items by `person_key`.
2. **Identify patterns**: Look for recurring themes, consistent attitudes, stated values, behavioral habits.
3. **Promote to traits**: Elevate mentions that reveal stable characteristics (not one-off comments or interview topics).
4. **Merge similar**: Combine semantically similar mentions into a single PersonaFacet with multiple evidence_refs.
5. **Filter noise**: Skip:
   - Generic interview content (topics discussed but not personal traits)
   - Single-use behaviors without attitudinal signal
   - Abstract concepts mentioned casually (e.g., "climate change" as a topic ≠ "concerned about climate" as a value)

## PersonaFacet Criteria
Each `PersonaFacet.value` must be:
- **Enduring**: Represents a stable trait, not momentary state
- **Personal**: Describes the person, not just interview content
- **Specific**: Concrete phrasing with subject+predicate (e.g., "prefers async communication for focus")
- **Evidence-backed**: Supported by at least 1 FacetMention (ideally 2+)

## kind_slug Guide
- **motivation**: What drives them (e.g., "motivated by learning new skills")
- **value**: What they believe matters (e.g., "values work-life balance")
- **attitude**: How they view things (e.g., "skeptical of AI accuracy")
- **skill**: What they're good at (e.g., "proficient in visual design")
- **preference**: How they like to work (e.g., "prefers written documentation")
- **personality**: Behavioral tendencies (e.g., "introverted in large groups")
- **identity**: Self-concept (e.g., "identifies as generalist designer")
- **belief**: Worldview elements (e.g., "believes design should serve society")
- **habit**: Regular behaviors (e.g., "reviews notes daily before class")
- **constraint**: Limitations (e.g., "limited by budget for tools")

## Evidence
{{ extraction }}

## Guardrails
- Each `evidence_refs` array must contain valid `FacetMention.index` values from the input.
- `confidence` should reflect: frequency (more mentions = higher), consistency (contradictions lower it), salience (strong emotional/attitudinal signal).
- Do NOT create facets for interview topics unless they reveal a personal stance/value/habit.
- When merging mentions, combine `evidence_refs` arrays.
- Prefer 3-10 high-quality facets per person over 50+ low-signal ones.

Output ONLY valid JSON conforming to {{ ctx.output_format }}.
"#
}

// Test with sample extraction
test DerivePersonaFacets_Sample {
  functions [DerivePersonaFacetsFromEvidence]
  args {
    extraction {
      people [
        {
          person_key: "participant-1"
          display_name: "SPEAKER 2"
          inferred_name: "Kai"
          role: "participant"
        }
      ]
      evidence [
        {
          index: 0
          person_key: "participant-1"
          gist: "Uses AI daily for essay writing"
          chunk: "I use AI majority of the time when working through essays to help connect ideas together and format properly."
          verbatim: "I use AI majority of the time"
          anchors: {
            speaker_label: "SPEAKER 2"
          }
          confidence: "high"
        },
        {
          index: 1
          person_key: "participant-1"
          gist: "Prefers working solo over groups"
          chunk: "I think personally I work better when I'm alone."
          verbatim: "I work better when I'm alone"
          anchors: {
            speaker_label: "SPEAKER 2"
          }
          confidence: "high"
        }
      ]
      facet_mentions [
        {
          index: 0
          parent_index: 0
          person_key: "participant-1"
          kind_slug: "tool"
          value: "uses AI for essay writing and formatting"
          confidence: 0.9
        },
        {
          index: 1
          parent_index: 0
          person_key: "participant-1"
          kind_slug: "behavior"
          value: "uses AI majority of time for academic work"
          confidence: 0.85
        },
        {
          index: 2
          parent_index: 1
          person_key: "participant-1"
          kind_slug: "preference"
          value: "prefers solo work over group work"
          confidence: 0.9
        },
        {
          index: 3
          parent_index: 1
          person_key: "participant-1"
          kind_slug: "value"
          value: "values working independently"
          confidence: 0.8
        }
      ]
      scenes []
    }
  }
}
