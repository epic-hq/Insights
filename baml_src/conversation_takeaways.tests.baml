// Tests for ExtractConversationTakeaways

// ── Sales call with BANT context ─────────────────────────────────────
test ConversationTakeaways_SalesWithBANT {
  functions [ExtractConversationTakeaways]
  args {
    evidence [
      {
        id "ev-001"
        verbatim "We're paying 120k a year for Looker but only 10 out of 30 seats are active."
        gist "High spend on underutilized analytics tool"
        speaker "Mike, VP Engineering"
        evidence_type "pain_point"
        timestamp_start 22.5
      },
      {
        id "ev-002"
        verbatim "Our Looker contract renews in March. I'd want something in place by February."
        gist "Hard deadline for switching analytics tools"
        speaker "Mike, VP Engineering"
        evidence_type "commitment"
        timestamp_start 80.0
      },
      {
        id "ev-003"
        verbatim "Our CTO has final sign-off. And I'd want our lead PM to test it."
        gist "Two additional stakeholders needed for decision"
        speaker "Mike, VP Engineering"
        evidence_type "commitment"
        timestamp_start 95.0
      },
      {
        id "ev-004"
        verbatim "We end up making gut calls more than I'd like. Last quarter we launched a feature based on assumptions and it flopped."
        gist "Lack of data access leading to poor product decisions"
        speaker "Mike, VP Engineering"
        evidence_type "pain_point"
        timestamp_start 40.0
      }
    ]
    bant_summary "Budget: 120k/year current spend. Authority: VP Eng (champion), CTO (decision maker). Need: Self-serve dashboards, Snowflake integration. Timeline: Feb deadline, March renewal."
    meddic_summary null
    stakeholders_summary "Mike (VP Engineering) - Champion. CTO - Economic buyer. Lead PM - End user evaluator."
    duration_minutes 12
    custom_instructions null
  }
}

// ── Support escalation (no sales context) ────────────────────────────
test ConversationTakeaways_SupportEscalation {
  functions [ExtractConversationTakeaways]
  args {
    evidence [
      {
        id "ev-010"
        verbatim "This is the third time this month our scheduled CSV exports have failed silently."
        gist "Recurring silent export failures"
        speaker "Customer"
        evidence_type "pain_point"
        timestamp_start 6.0
      },
      {
        id "ev-011"
        verbatim "Our CFO is furious."
        gist "Executive-level frustration with reliability"
        speaker "Customer"
        evidence_type "pain_point"
        timestamp_start 28.0
      },
      {
        id "ev-012"
        verbatim "We're in our renewal evaluation right now and this isn't helping."
        gist "Churn risk tied to reliability issues"
        speaker "Customer"
        evidence_type "commitment"
        timestamp_start 62.0
      },
      {
        id "ev-013"
        verbatim "Your dataset has grown 3x since you set these up."
        gist "Root cause: data volume outgrew export config"
        speaker "Agent"
        evidence_type "desire"
        timestamp_start 38.0
      }
    ]
    bant_summary null
    meddic_summary null
    stakeholders_summary null
    duration_minutes 8
    custom_instructions null
  }
}

// ── Research interview with custom instructions ──────────────────────
test ConversationTakeaways_ResearchWithCustom {
  functions [ExtractConversationTakeaways]
  args {
    evidence [
      {
        id "ev-020"
        verbatim "I signed up for three different platforms and kept bouncing between them because none felt right."
        gist "Platform fatigue from mismatched skill levels"
        speaker "Participant"
        evidence_type "pain_point"
        timestamp_start 5.0
      },
      {
        id "ev-021"
        verbatim "I have maybe 30 minutes a day to learn and I was spending half figuring out which lesson to do next."
        gist "Time wasted on navigation instead of learning"
        speaker "Participant"
        evidence_type "pain_point"
        timestamp_start 43.0
      },
      {
        id "ev-022"
        verbatim "Something that asks me what I already know, gives me a quick assessment, and builds a path from there."
        gist "Desire for adaptive skill assessment and personalized paths"
        speaker "Participant"
        evidence_type "desire"
        timestamp_start 60.0
      }
    ]
    bant_summary null
    meddic_summary null
    stakeholders_summary null
    duration_minutes 15
    custom_instructions "Focus on learning experience design implications. What does this tell us about our onboarding flow?"
  }
}

// ── Minimal evidence (edge case) ─────────────────────────────────────
test ConversationTakeaways_MinimalEvidence {
  functions [ExtractConversationTakeaways]
  args {
    evidence [
      {
        id "ev-030"
        verbatim "We need this fixed by Friday."
        gist "Urgent timeline"
        speaker "Customer"
        evidence_type "commitment"
        timestamp_start 10.0
      }
    ]
    bant_summary null
    meddic_summary null
    stakeholders_summary null
    duration_minutes 3
    custom_instructions null
  }
}
