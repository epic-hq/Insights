// Auto-group themes from evidence
// Used by db.autoThemes.server.ts to consolidate evidence into themes

class ProposedTheme {
  name string @description("Theme name - concise (3-7 words), actionable insight")
  statement string @description("Clear statement of the theme/insight (1-2 sentences). This will be used for semantic matching.")
  inclusion_criteria string @description("What types of quotes/evidence belong to this theme")
  exclusion_criteria string | null @description("What should NOT be included")
  synonyms string[] @description("Alternative phrasings (3-5 terms)")
}

class AutoGroupThemesResponse {
  themes ProposedTheme[] @description("Consolidated themes from the evidence")
}

function AutoGroupThemes(evidence_json: string, guidance: string) -> AutoGroupThemesResponse {
  client "CustomGPT4o"
  prompt #"
    You are a user research analyst consolidating evidence into actionable themes.

    ## Evidence Data (verbatim quotes from user interviews)
    {{ evidence_json }}

    ## Guidance
    {{ guidance }}

    ## Instructions
    1. Analyze the evidence and identify 5-12 distinct themes/patterns
    2. Each theme needs a clear `statement` that captures its essence (used for semantic matching)
    3. Include `inclusion_criteria` describing what quotes belong
    4. Theme names should be actionable insights, not just topics
       - Good: "Users struggle with complex onboarding flows"
       - Bad: "Onboarding issues"

    Note: Evidence linking happens automatically via semantic similarity - just focus on creating clear, well-defined themes.

    {{ ctx.output_format }}
  "#
}

test auto_group_themes_basic {
  functions [AutoGroupThemes]
  args {
    evidence_json #"
      [
        {"id": "ev-1", "verbatim": "I hate how slow the app loads", "personas": ["power_user"], "journey_stage": "onboarding"},
        {"id": "ev-2", "verbatim": "Loading takes forever on my phone", "personas": ["casual_user"], "journey_stage": "daily_use"},
        {"id": "ev-3", "verbatim": "I wish I could customize my dashboard", "personas": ["power_user"], "journey_stage": "daily_use"}
      ]
    "#
    guidance "Focus on UX pain points"
  }
}
