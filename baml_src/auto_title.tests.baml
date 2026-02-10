// Tests for GenerateTitleFromContent

// ── Sales call transcript ────────────────────────────────────────────
test GenerateTitle_SalesCall {
  functions [GenerateTitleFromContent]
  args {
    content #"
      Discussion about migrating from Looker to a self-serve analytics platform.
      Key topics: pricing comparison, Snowflake integration requirements, timeline
      for Q1 evaluation, and stakeholder sign-off process with CTO involvement.
    "#
  }
}

// ── Technical discussion ─────────────────────────────────────────────
test GenerateTitle_TechDiscussion {
  functions [GenerateTitleFromContent]
  args {
    content #"
      Deep dive into webhook retry logic and idempotency key edge cases.
      Team decided on a two-day scoped fix for the retry path to unblock
      the Q1 launch, with a follow-up tech debt ticket for full webhook
      system refactoring.
    "#
  }
}

// ── User research interview ──────────────────────────────────────────
test GenerateTitle_ResearchInterview {
  functions [GenerateTitleFromContent]
  args {
    content #"
      Interview with high school tutor about challenges facing underserved
      students in East Palo Alto. Discussion of limited worldview exposure,
      mentorship programs pairing Stanford students with high schoolers,
      and the importance of individualized education approaches for students
      with different learning styles.
    "#
  }
}

// ── Product feedback ─────────────────────────────────────────────────
test GenerateTitle_ProductFeedback {
  functions [GenerateTitleFromContent]
  args {
    content #"
      Customer frustrated with export failures on enterprise plan. CSV exports
      timing out silently due to 3x data growth. No error notifications sent.
      Requesting root cause analysis before renewal evaluation completes.
    "#
  }
}

// ── Empty content edge case ──────────────────────────────────────────
test GenerateTitle_EmptyContent {
  functions [GenerateTitleFromContent]
  args {
    content ""
  }
}

// ── Very short content ───────────────────────────────────────────────
test GenerateTitle_ShortContent {
  functions [GenerateTitleFromContent]
  args {
    content "Quick sync about the roadmap priorities for next sprint."
  }
}
