// Tests for GenerateKeyTakeawaysFromEvidence

// ── Research interview evidence ──────────────────────────────────────
test KeyTakeaways_ResearchEvidence {
  functions [GenerateKeyTakeawaysFromEvidence]
  args {
    evidence [
      {
        person_key "participant-1"
        speaker_label "PARTICIPANT"
        gist "Bounces between learning platforms"
        chunk "I signed up for three different platforms — Codecademy, Coursera, and YouTube tutorials. I kept bouncing between them because none of them felt right. Each one assumed a different starting point."
        verbatim "none of them felt right"
        anchors {
          start_ms 5000
          end_ms 18000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "pain"
            value "mismatched skill level across learning platforms"
            quote "none of them felt right"
          },
          {
            person_key "participant-1"
            kind_slug "tool"
            value "Codecademy"
            quote null
          },
          {
            person_key "participant-1"
            kind_slug "tool"
            value "Coursera"
            quote null
          }
        ]
        isQuestion false
        says ["none of them felt right"]
        does ["bounces between 3 learning platforms"]
        thinks ["existing platforms don't understand my level"]
        feels ["frustrated with wasted time"]
        pains ["When trying to learn Python, blocked by platforms assuming wrong starting point"]
        gains null
      },
      {
        person_key "participant-1"
        speaker_label "PARTICIPANT"
        gist "Wastes learning time on navigation"
        chunk "I have maybe 30 minutes a day to learn and I was spending half of it figuring out which lesson to do next instead of actually coding. After two weeks I just gave up."
        verbatim "spending half figuring out which lesson"
        anchors {
          start_ms 43000
          end_ms 55000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "pain"
            value "time wasted on lesson selection instead of learning"
            quote "spending half figuring out which lesson"
          },
          {
            person_key "participant-1"
            kind_slug "behavior"
            value "allocates 30 minutes daily to learning"
            quote "maybe 30 minutes a day"
          }
        ]
        isQuestion false
        says null
        does ["allocates 30 min daily to learning"]
        thinks null
        feels ["defeated after two weeks"]
        pains ["When time-constrained, blocked by poor lesson sequencing"]
        gains ["so I can spend all 30 minutes actually coding"]
      },
      {
        person_key "participant-1"
        speaker_label "PARTICIPANT"
        gist "Wants adaptive skill assessment"
        chunk "Something that asks me what I already know, gives me a quick assessment, and then builds a path from there. And it would track what I've actually retained, not just what videos I watched."
        verbatim "asks me what I already know"
        anchors {
          start_ms 60000
          end_ms 72000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "goal"
            value "personalized learning path based on existing knowledge"
            quote "asks me what I already know"
          },
          {
            person_key "participant-1"
            kind_slug "requirements"
            value "retention tracking over completion tracking"
            quote "track what I've actually retained"
          }
        ]
        isQuestion false
        says ["track what I've actually retained, not just what videos I watched"]
        does null
        thinks ["completion metrics are meaningless for real learning"]
        feels ["hopeful about adaptive approaches"]
        pains null
        gains ["so I can learn efficiently in limited time"]
      },
      {
        person_key "interviewer-1"
        speaker_label "INTERVIEWER"
        gist "Probes for ideal learning experience"
        chunk "If you could design the perfect learning experience, what would it look like?"
        verbatim "design the perfect learning experience"
        anchors {
          start_ms 55000
          end_ms 60000
          chapter_title null
          char_span null
        }
        facet_mentions []
        isQuestion true
        says null
        does null
        thinks null
        feels null
        pains null
        gains null
      }
    ]
    userCustomInstructions "Focus on onboarding and initial user experience. What does this tell us about how new users should be greeted?"
  }
}

// ── Sales call evidence ──────────────────────────────────────────────
test KeyTakeaways_SalesEvidence {
  functions [GenerateKeyTakeawaysFromEvidence]
  args {
    evidence [
      {
        person_key "participant-1"
        speaker_label "SPEAKER B"
        gist "High spend on underutilized tool"
        chunk "We're paying about 120k a year for 30 Looker seats but honestly only 10 people actually use it regularly. The rest gave up because the learning curve was too steep."
        verbatim "only 10 people actually use it"
        anchors {
          start_ms 22500
          end_ms 35000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "pain"
            value "low adoption due to steep learning curve"
            quote "learning curve was too steep"
          },
          {
            person_key "participant-1"
            kind_slug "tool"
            value "Looker"
            quote null
          }
        ]
        isQuestion false
        says ["only 10 people actually use it regularly"]
        does null
        thinks null
        feels null
        pains ["When onboarding team to analytics, blocked by steep learning curve"]
        gains null
      },
      {
        person_key "participant-1"
        speaker_label "SPEAKER B"
        gist "Gut decisions from data access gap"
        chunk "We end up making gut calls more than I'd like. Last quarter we launched a feature based on assumptions and it flopped. If we'd had the usage data faster we would have caught it."
        verbatim "making gut calls more than I'd like"
        anchors {
          start_ms 40000
          end_ms 55000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "pain"
            value "data access gap causing poor product decisions"
            quote "launched a feature based on assumptions and it flopped"
          }
        ]
        isQuestion false
        says null
        does ["makes product decisions without data"]
        thinks null
        feels ["regretful about recent feature flop"]
        pains null
        gains ["so I can catch product issues before launch"]
      },
      {
        person_key "participant-1"
        speaker_label "SPEAKER B"
        gist "Hard deadline for tool switch"
        chunk "Our Looker contract renews in March. I'd want to have something in place by February so we can run both in parallel for a month."
        verbatim "contract renews in March"
        anchors {
          start_ms 80000
          end_ms 90000
          chapter_title null
          char_span null
        }
        facet_mentions [
          {
            person_key "participant-1"
            kind_slug "context"
            value "Looker contract renewal March, needs replacement by February"
            quote "contract renews in March"
          }
        ]
        isQuestion false
        says null
        does null
        thinks null
        feels null
        pains null
        gains null
      }
    ]
    userCustomInstructions ""
  }
}
