// Tests for persona extraction and assignment functions

// ── NormalizeNotes: raw interview notes ──────────────────────────────
test NormalizeNotes_RawFieldNotes {
  functions [NormalizeNotes]
  args {
    raw_notes #"
      Interview with Maria, 34, product manager at a mid-size SaaS company
      Date: 2026-01-15

      She said "I spend more time in meetings about the roadmap than actually building the roadmap"

      Uses Notion for specs, Linear for tracking, Figma for design reviews
      Checks Linear 8-10 times per day
      Frustrated that stakeholder requests come through Slack DMs instead of a formal process

      When asked about her biggest challenge:
      "Honestly the hardest part is saying no. Every team thinks their feature is the most important
      and I don't have good data to back up prioritization decisions."

      Goal: wants to make data-driven prioritization decisions
      Currently relies on gut feel and loudest voice in the room

      Interviewer note: She seemed really energized when talking about using customer evidence
      to push back on HiPPO decisions. This is clearly a pain point she's passionate about.

      Off-topic: discussed lunch plans, weather
    "#
  }
}

// ── NormalizeNotes: messy voice memo transcript ──────────────────────
test NormalizeNotes_VoiceMemo {
  functions [NormalizeNotes]
  args {
    raw_notes #"
      ok so just got off the call with the acme team, few things to note...
      um they're using spreadsheets for everything, like literally tracking
      customer health scores in google sheets... the CS lead, Jamie, said
      quote "we know we need a real tool but every time we evaluate something
      it's either too expensive or too complicated to set up" end quote.
      Also interesting - they have 200 customers but only 3 CS reps.
      That's wild. ratio is way off. they're basically firefighting all day.
      Jamie mentioned she stays late most nights just to keep up.
      oh and they want something that integrates with hubspot, that's a must-have.
    "#
  }
}

// ── ExtractEvidence from normalized doc ──────────────────────────────
test ExtractEvidence_FromNormalizedDoc {
  functions [ExtractEvidence]
  args {
    doc {
      source "Interview with Maria, PM at SaaS Co - 2026-01-15"
      snippets [
        {
          tag "QUOTE"
          text "I spend more time in meetings about the roadmap than actually building the roadmap"
          speaker "Maria"
          timestamp "00:03:21"
        },
        {
          tag "PAIN"
          text "Stakeholder requests come through Slack DMs instead of a formal intake process, making prioritization impossible"
          speaker "Maria"
          timestamp null
        },
        {
          tag "BEHAVIOR"
          text "Checks Linear 8-10 times per day for status updates"
          speaker "Maria"
          timestamp null
        },
        {
          tag "GOAL"
          text "Wants to make data-driven prioritization decisions instead of relying on gut feel"
          speaker "Maria"
          timestamp null
        },
        {
          tag "QUOTE"
          text "The hardest part is saying no. Every team thinks their feature is the most important and I don't have good data to back up prioritization decisions."
          speaker "Maria"
          timestamp "00:12:45"
        },
        {
          tag "TRIGGER"
          text "Gets energized by the idea of using customer evidence to push back on HiPPO decisions"
          speaker null
          timestamp null
        },
        {
          tag "FACT"
          text "Uses Notion for specs, Linear for tracking, Figma for design reviews"
          speaker "Maria"
          timestamp null
        }
      ]
    }
  }
}

// ── AssignPersonaToInterview: should assign existing ─────────────────
test AssignPersona_MatchExisting {
  functions [AssignPersonaToInterview]
  args {
    interview_transcript #"
      Interviewer: Tell me about your role.
      Participant: I'm a product manager at a 50-person startup. I own the roadmap for our core platform.
      Interviewer: What's your biggest challenge?
      Participant: Prioritization. Everyone wants their feature built first and I don't have enough data to make objective trade-offs. I end up relying on whoever is loudest.
      Interviewer: What tools do you use?
      Participant: Linear for tracking, Notion for specs. I check Linear probably 10 times a day. We do weekly stakeholder reviews but honestly most requests come through Slack DMs.
      Interviewer: What would make your job easier?
      Participant: Real customer evidence I can point to. Like, here's what 15 customers said about this problem. That would change how I prioritize completely.
    "#
    participant_info "Sarah Chen, Product Manager, 32, Series B startup, 50 employees"
    existing_personas #"
      [
        {
          "id": "persona-001",
          "name": "The Data-Hungry PM",
          "description": "Mid-career product manager at growth-stage startup who struggles with evidence-based prioritization. Drowning in stakeholder requests via informal channels. Wants objective data to defend roadmap decisions.",
          "goals": ["Make data-driven prioritization decisions", "Reduce time in status meetings", "Build credibility with stakeholders"],
          "pain_points": ["No formal request intake", "Gut-feel prioritization", "Too many meetings"],
          "behaviors_habits": ["Checks project tracker 8-10x daily", "Uses Notion + Linear stack", "Weekly stakeholder reviews"],
          "evidence_count": 3,
          "confidence": "Medium"
        },
        {
          "id": "persona-002",
          "name": "The Firefighting CS Lead",
          "description": "Customer success manager at understaffed team managing 60+ accounts solo. Reactive by necessity, wants proactive health monitoring.",
          "goals": ["Proactive churn prevention", "Scale without hiring"],
          "pain_points": ["Too many accounts per rep", "Manual health scoring", "No early warning system"],
          "behaviors_habits": ["Spreadsheet-based tracking", "Stays late most nights", "Triages by gut feel"],
          "evidence_count": 1,
          "confidence": "Low"
        }
      ]
    "#
  }
}

// ── AssignPersonaToInterview: should create new ──────────────────────
test AssignPersona_CreateNew {
  functions [AssignPersonaToInterview]
  args {
    interview_transcript #"
      Interviewer: What's your role?
      Participant: I'm head of sales engineering. I lead a team of 8 SEs who do demos and technical evaluations for enterprise deals.
      Interviewer: What's the biggest bottleneck in your process?
      Participant: Creating custom demo environments. Each prospect wants to see their specific use case and it takes us 2-3 days to spin up a tailored demo. We lose deals because competitors can show something faster.
      Interviewer: How do you decide which deals to prioritize?
      Participant: Deal size and close probability. But honestly we're guessing on probability. We don't have good signals from the sales calls about how serious a prospect is.
      Interviewer: What would help most?
      Participant: Two things - a way to create demo environments in hours not days, and better intelligence from discovery calls so we know what to demo.
    "#
    participant_info "James Park, Head of Sales Engineering, Enterprise SaaS, 45 employees"
    existing_personas #"
      [
        {
          "id": "persona-001",
          "name": "The Data-Hungry PM",
          "description": "Mid-career product manager at growth-stage startup who struggles with evidence-based prioritization.",
          "goals": ["Make data-driven prioritization decisions"],
          "pain_points": ["No formal request intake", "Gut-feel prioritization"],
          "behaviors_habits": ["Checks project tracker 8-10x daily"],
          "evidence_count": 3,
          "confidence": "Medium"
        }
      ]
    "#
  }
}
