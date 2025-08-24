// Extract Evidence BAML Schema and Function
// Produces normalized evidence units from transcripts + chapters

class Anchor {
  type string @description("av | doc | web | message | log")
  target string @description("media_id | doc_id | URL | stream id")
  start string @description("av: ms (number-as-string OK); doc: p14#para3; web: selector; log: ISO time")
  end string? @description("optional end position")
}

class KindTags {
  problem string[]?
  goal string[]?
  behavior string[]?
  emotion Emotions? @description("Optional emotion if obvious from context")
  context string[]?
  artifact string[]?
}

class EvidenceUnit {
  verbatim string @description("Exact quote or concise snippet. Keep short and citable.")
  support string @description("supports | refutes | neutral")
  kind_tags KindTags @description("Canonical tag buckets for clustering")
  personas string[]? @description("Optional persona labels if obvious from context")
  segments string[]? @description("Optional segment labels if obvious from context")
  journey_stage string? @description("Optional journey stage if clear")
  anchors Anchor[] @description("At least one deep-link anchor to source")
  confidence string @description("low | medium | high")
}

class Chapter {
  start_ms int
  end_ms int?
  summary string?
  title string?
}

function ExtractEvidenceFromTranscript(
  transcript: string,
  chapters: Chapter[],
  language: string
) -> EvidenceUnit[] {
  client "CustomGPT4o"
  prompt #"
    You are an expert UX researcher. Extract concise, citable evidence units from the transcript.

    Rules
    - Prefer short, verbatim quotes over long passages; trim filler.
    - Each unit must include at least one Anchor pointing to the exact location.
    - Classify tags into canonical buckets: problem, goal, behavior, emotion, context, artifact.
    - Set support = supports | refutes | neutral relative to the observed statement.
    - Confidence: low | medium | high based on clarity and specificity.
    - Only infer persona/segment/journey_stage when obvious.

    Transcript (language={{ language }})
    {{ transcript }}

    Chapters (optional; may help anchoring)
    {{ chapters }}

    Output strictly as an array of EvidenceUnit respecting {{ ctx.output_format }}
  "#
}

// Dev test
test ExtractEvidenceFromTranscript_Sample {
  functions [ExtractEvidenceFromTranscript]
  args {
    transcript #"
      Interviewer: How was it getting started with the app?
      Participant: Honestly, finding the billing settings was confusing. I clicked around for 5 minutes.
      Interviewer: Did you figure it out?
      Participant: Eventually, but after a lot of wasted time frankly, on mobile it's even worse.
			Interviewer: how was the output from the AI?
      Participant: It was so good i was afraid of getting caught cheating!
    "#
    chapters [ { start_ms 0, end_ms 60000, title "Onboarding" } ]
    language "en"
  }
}
