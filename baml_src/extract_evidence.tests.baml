// Tests for ExtractEvidenceFromTranscriptV2
// Core pipeline function — most critical for interview processing reliability

// ── Sales call: should detect Sales interaction context ──────────────
test ExtractEvidence_SalesCall {
  functions [ExtractEvidenceFromTranscriptV2]
  args {
    speaker_transcripts [
      {
        speaker "SPEAKER A"
        text "Thanks for taking the time today, Sarah. I wanted to walk you through our new analytics dashboard and see if it could help your team."
        start 0
        end 8000
      },
      {
        speaker "SPEAKER B"
        text "Sure. We've been evaluating a few tools. Right now we use Looker but it's way too expensive for what we get. Our contract is up in March."
        start 8500
        end 18000
      },
      {
        speaker "SPEAKER A"
        text "Got it. What does your team spend on Looker annually?"
        start 18500
        end 22000
      },
      {
        speaker "SPEAKER B"
        text "About 120k a year for 30 seats. Honestly only 10 people actually use it regularly. The rest gave up because the learning curve was too steep."
        start 22500
        end 35000
      },
      {
        speaker "SPEAKER A"
        text "That's a common issue we hear. Our pricing is per active user, so you'd only pay for those 10. Would a 2-week pilot with your core team be helpful?"
        start 35500
        end 48000
      },
      {
        speaker "SPEAKER B"
        text "Yeah, that would be great. I need to loop in our VP of Engineering though — she has final say on tooling decisions. Can we set something up for next week?"
        start 48500
        end 60000
      }
    ]
    chapters []
    language "en"
  }
}

// ── Support conversation: should detect Support context ──────────────
test ExtractEvidence_SupportConversation {
  functions [ExtractEvidenceFromTranscriptV2]
  args {
    speaker_transcripts [
      {
        speaker "AGENT"
        text "Hi, this is Alex from support. I see you submitted a ticket about export failures. Can you tell me more about what's happening?"
        start 0
        end 10000
      },
      {
        speaker "CUSTOMER"
        text "Yeah, every time I try to export a report as PDF, it just hangs and then times out. I've tried three different browsers. This has been happening since last Tuesday's update."
        start 10500
        end 25000
      },
      {
        speaker "AGENT"
        text "I'm sorry about that. Let me check your account. Are you on the enterprise plan?"
        start 25500
        end 32000
      },
      {
        speaker "CUSTOMER"
        text "Yes, we're on enterprise. We need this fixed ASAP — our quarterly board report is due Friday and we can't generate it without exports working."
        start 32500
        end 45000
      }
    ]
    chapters []
    language "en"
  }
}

// ── Single-speaker debrief/voice memo ────────────────────────────────
test ExtractEvidence_VoiceMemo {
  functions [ExtractEvidenceFromTranscriptV2]
  args {
    speaker_transcripts [
      {
        speaker "SPEAKER A"
        text "Just got off the call with the Acme team. Three big takeaways. First, they're definitely interested in the annual plan but need a 15% discount to get it past procurement. Second, the VP of Product, Janet, is our champion — she's been pushing internally for months. Third, they want SSO before they'll sign anything. Their security team won't budge on that."
        start 0
        end 30000
      },
      {
        speaker "SPEAKER A"
        text "Action items for me: send the discounted proposal by Wednesday, get the SSO timeline from engineering, and schedule a follow-up with Janet for next week. I think we can close this in Q1 if we move fast."
        start 30500
        end 50000
      }
    ]
    chapters []
    language "en"
  }
}
