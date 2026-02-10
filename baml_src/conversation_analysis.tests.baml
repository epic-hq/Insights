// Tests for AnalyzeStandaloneConversation

// ── Sales discovery call ─────────────────────────────────────────────
test AnalyzeConversation_SalesDiscovery {
  functions [AnalyzeStandaloneConversation]
  args {
    transcript #"
      Sarah (Sales Rep) [0:00]: Hi Mike, thanks for hopping on. I wanted to learn more about your team's analytics workflow.
      Mike (VP Engineering) [0:08]: Sure. We've been using Looker for about two years but honestly it's become a bottleneck. Only a few people on the team can actually build reports.
      Sarah [0:18]: What happens when someone needs a new report?
      Mike [0:22]: They file a ticket with our data team. Average turnaround is about a week. For urgent stuff we can do two days but it creates a lot of stress.
      Sarah [0:35]: How does that impact your decision-making?
      Mike [0:40]: We end up making gut calls more than I'd like. Last quarter we launched a feature based on assumptions and it flopped. If we'd had the usage data faster we would have caught it.
      Sarah [0:55]: What would an ideal solution look like for you?
      Mike [1:02]: Self-serve dashboards that my PMs can build themselves. No SQL required. And it needs to integrate with our Snowflake warehouse.
      Sarah [1:15]: Makes sense. What's your timeline for making a change?
      Mike [1:20]: Our Looker contract renews in March. I'd want to have something in place by February so we can run both in parallel for a month.
      Sarah [1:30]: Who else would need to be involved in the evaluation?
      Mike [1:35]: Our CTO has final sign-off. And I'd want our lead PM to test it since she'd be the heaviest user.
    "#
    context "B2B SaaS analytics platform sales call. Prospect is evaluating alternatives to Looker."
  }
}

// ── Customer support escalation ──────────────────────────────────────
test AnalyzeConversation_SupportEscalation {
  functions [AnalyzeStandaloneConversation]
  args {
    transcript #"
      Agent [0:00]: Hi, this is Lisa from the enterprise support team. I understand you're having issues with your data exports?
      Customer [0:06]: Yes, this is the third time this month our scheduled CSV exports have failed silently. No error notification, nothing. We only find out when finance asks where the report is.
      Agent [0:18]: I'm sorry about that. Can you tell me which export jobs are affected?
      Customer [0:22]: The daily revenue reconciliation and the weekly churn report. Both feed into our board deck. Our CFO is furious.
      Agent [0:32]: I see those jobs in our system. It looks like they're timing out due to the data volume increase. Your dataset has grown 3x since you set these up.
      Customer [0:42]: OK but why no error notification? We're paying for enterprise specifically for reliability guarantees.
      Agent [0:50]: You're right, the silent failure is a bug on our side. I'm going to escalate this to engineering as a P1. In the meantime, I can set up a workaround with smaller batch sizes.
      Customer [1:00]: Fine, but I need a root cause analysis by end of week. We're in our renewal evaluation right now and this isn't helping.
    "#
    context "Enterprise customer support escalation. Customer on annual enterprise plan, renewal coming up."
  }
}

// ── Research interview with empty context ────────────────────────────
test AnalyzeConversation_ResearchInterview {
  functions [AnalyzeStandaloneConversation]
  args {
    transcript #"
      Interviewer [0:00]: Tell me about the last time you tried to learn a new skill online.
      Participant [0:05]: I tried learning Python last month. I signed up for three different platforms — Codecademy, Coursera, and YouTube tutorials. I kept bouncing between them because none of them felt right.
      Interviewer [0:18]: What do you mean by "felt right"?
      Participant [0:22]: Each one assumed a different starting point. Codecademy was too basic, Coursera lectures were too theoretical, and YouTube was all over the place. I wanted something that met me where I was — I know some JavaScript so I'm not a total beginner, but I'm not ready for advanced Python either.
      Interviewer [0:40]: How did that make you feel?
      Participant [0:43]: Frustrated honestly. I have maybe 30 minutes a day to learn and I was spending half of it figuring out which lesson to do next instead of actually coding. After two weeks I just gave up.
      Interviewer [0:55]: If you could design the perfect learning experience, what would it look like?
      Participant [1:00]: Something that asks me what I already know, gives me a quick assessment, and then builds a path from there. And it would track what I've actually retained, not just what videos I watched.
    "#
    context ""
  }
}

// ── Internal team meeting ────────────────────────────────────────────
test AnalyzeConversation_InternalMeeting {
  functions [AnalyzeStandaloneConversation]
  args {
    transcript #"
      PM [0:00]: OK let's review where we are on the Q1 launch. Engineering, what's the status?
      Eng Lead [0:05]: Auth migration is done. API rate limiting ships tomorrow. The only blocker is the webhook retry logic — we found an edge case with idempotency keys.
      PM [0:15]: How long to fix?
      Eng Lead [0:18]: Two days if we scope it to just the retry path. A week if we want to refactor the whole webhook system.
      PM [0:25]: Let's do the two-day fix for launch and file a tech debt ticket for the refactor. Design, where are we?
      Designer [0:32]: Dashboard redesign is in final review. One open question — do we show the usage graph on the free tier or gate it?
      PM [0:40]: Good question. Let's gate it. It's one of our best upgrade drivers. Marketing, anything?
      Marketing [0:47]: Launch blog post is drafted. We need screenshots of the new dashboard and a quote from the beta customer. Can we get those by Thursday?
      PM [0:55]: I'll get the screenshots. Eng lead, can you ping the beta customer for a quote?
      Eng Lead [1:00]: Sure, I'll reach out to the Acme team today.
    "#
    context "Weekly product launch standup for Q1 release. Cross-functional team."
  }
}
