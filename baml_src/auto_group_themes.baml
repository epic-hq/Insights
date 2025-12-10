// Auto-group themes from evidence
// Used by db.autoThemes.server.ts to consolidate evidence into themes

class ThemeLink {
  evidence_id string @description("UUID of the evidence to link to this theme")
  rationale string @description("Why this evidence belongs to this theme (1-2 sentences)")
  confidence float @description("Confidence score 0.0-1.0 that this evidence belongs to this theme")
}

class ProposedTheme {
  name string @description("Theme name - concise (3-7 words), actionable insight")
  statement string | null @description("Clear statement of the theme/insight (1-2 sentences)")
  inclusion_criteria string | null @description("What evidence should be included in this theme")
  exclusion_criteria string | null @description("What evidence should NOT be included")
  synonyms string[] @description("Alternative phrasings or related terms")
  anti_examples string[] @description("Examples that seem related but don't belong")
  links ThemeLink[] @description("Evidence IDs that belong to this theme with rationale")
}

class AutoGroupThemesResponse {
  themes ProposedTheme[] @description("Consolidated themes from the evidence")
}

function AutoGroupThemes(evidence_json: string, guidance: string) -> AutoGroupThemesResponse {
  client "CustomGPT4o"
  prompt #"
    You are a user research analyst consolidating evidence into actionable themes/insights.

    ## Your Task
    Analyze the evidence and group it into **consolidated themes**. Each theme should represent a distinct pattern observed across multiple pieces of evidence.

    ## Evidence Data
    {{ evidence_json }}

    ## Additional Guidance
    {{ guidance }}

    ## Rules
    1. Create **5-15 themes maximum** - consolidate aggressively
    2. Each theme should have evidence from **2+ different sources** when possible
    3. Theme names should be **actionable insights**, not just topics
       - Good: "Users abandon onboarding when asked for payment info"
       - Bad: "Payment issues"
    4. Link each piece of evidence to **at most 1-2 themes** (avoid over-linking)
    5. Include `evidence_id` from the input data in your links
    6. Set confidence based on how well the evidence supports the theme:
       - 0.9+ = Direct quote or clear behavior supporting the theme
       - 0.7-0.9 = Strong implied support
       - 0.5-0.7 = Moderate support, some interpretation needed
       - <0.5 = Weak support, don't include

    ## Output Format
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
