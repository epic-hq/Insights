# UpSight Platform Vision

> **Status:** Vision Draft | **Last Updated:** January 2025

---

## The Problem

**Customer knowledge is fragmented across dozens of tools, and none of them talk to each other.**

A typical customer-facing team uses:
- **Email** (Gmail, Outlook) – where conversations happen
- **Calendar** (Google, Outlook) – where meetings are scheduled
- **Meeting tools** (Zoom, Meet) – where calls are recorded
- **CRM** (Salesforce, HubSpot) – where deals are tracked
- **Support** (Zendesk, Intercom) – where tickets live
- **Surveys** (Typeform, SurveyMonkey) – where feedback is collected
- **Docs** (Notion, Google Docs) – where notes are written
- **Spreadsheets** (Sheets, Excel) – where data lives
- **Analytics** (Amplitude, Mixpanel) – where usage is tracked
- **Slack/Teams** – where internal discussion happens

**The result:**
- Before a meeting, you scramble to find context
- After a meeting, notes go into a doc nobody reads
- Customer insights are trapped in individual inboxes
- Decisions are made on opinion because evidence is too hard to find
- The same questions get asked in every call because nobody remembers

**The deeper problem:**
Teams have two modes of work that are completely disconnected:

1. **Daily Operations** – Reply to this email, prep for this meeting, follow up on this call
2. **Strategic Analysis** – What are customers saying? What should we prioritize? How do we prove ROI?

No tool serves both. Gong analyzes calls but doesn't help you reply to emails. Notion holds docs but doesn't know your customers. Superhuman speeds up email but has no customer intelligence.

---

## The Insight

**The same customer knowledge that powers strategic decisions should power daily operations.**

When you're about to email a customer, you should know:
- What they said in last week's call
- What support tickets they've filed
- What their NPS score is
- What themes they care about

When you're preparing for a meeting, you should have:
- Summary of all prior interactions
- Key pain points and goals
- Relevant evidence from similar customers
- Suggested talking points

When you're writing a report, you should be able to:
- Pull in verified facts and metrics
- Embed video evidence
- Link to source conversations
- Show confidence levels

**The insight:** Customer intelligence isn't a separate activity. It's the foundation that should power everything.

---

## The Vision

**UpSight is the customer intelligence platform that captures every interaction, synthesizes what matters, and powers both daily work and strategic decisions.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UPSIGHT PLATFORM                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   CAPTURE   │  │  SYNTHESIZE │  │     ACT     │  │ COMMUNICATE│ │
│  │             │  │             │  │             │  │            │ │
│  │ • Email     │  │ • Evidence  │  │ • Email     │  │ • Stories  │ │
│  │ • Calendar  │  │ • Themes    │  │   assist    │  │ • Reels    │ │
│  │ • Meetings  │  │ • Personas  │  │ • Meeting   │  │ • Reports  │ │
│  │ • Calls     │  │ • Insights  │  │   prep      │  │ • Embeds   │ │
│  │ • Tickets   │  │ • Key Facts │  │ • Follow-up │  │ • Decks    │ │
│  │ • Surveys   │  │ • Alerts    │  │ • Drafts    │  │ • Briefs   │ │
│  │ • Analytics │  │             │  │             │  │            │ │
│  │ • Docs      │  │             │  │             │  │            │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
│         │                │                │               │         │
│         └────────────────┴────────────────┴───────────────┘         │
│                                   │                                  │
│                    ┌──────────────┴──────────────┐                  │
│                    │      CHIEF OF STAFF         │                  │
│                    │   (AI that knows everything) │                  │
│                    └─────────────────────────────┘                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Four Pillars

### 1. CAPTURE – Every customer interaction, unified

**Sources we support today:**
- ✅ Interviews (recorded research conversations)
- ✅ Ask Links (surveys with video responses)
- ✅ Documents (uploaded files)

**Sources we need:**
| Source | What It Captures | Priority |
|--------|------------------|----------|
| **Email** (Gmail, Outlook) | Customer conversations, context | High |
| **Calendar** | Meeting schedule, attendees, context | High |
| **Meeting recordings** | All calls, not just "interviews" | High |
| **Google Sheets** | Data, metrics, facts | High |
| **Gong/Chorus** | Sales calls (import) | Medium |
| **Zendesk/Intercom** | Support tickets | Medium |
| **Slack/Teams** | Internal + external threads | Medium |
| **CRM** (Salesforce, HubSpot) | Deal context, account data | Medium |
| **Analytics** (Amplitude, Mixpanel) | Usage data, metrics | Medium |
| **NPS/CSAT tools** | Survey responses | Low |
| **App reviews** | Public feedback | Low |

**Key principle:** We don't replace these tools. We connect to them and extract customer intelligence.

### 2. SYNTHESIZE – AI extracts what matters

**What we do today:**
- ✅ Evidence extraction (quotes, clips, timestamps)
- ✅ Theme clustering
- ✅ Persona building
- ✅ Insight generation
- ✅ Empathy map facets (pains, gains, feels)

**What we need:**
| Capability | What It Does |
|------------|--------------|
| **Key Facts** | Store verified metrics with source + date |
| **Account Intelligence** | Synthesize everything about one customer |
| **Cross-source linking** | Connect email thread → meeting → ticket |
| **Alerts** | "Churn signal detected" or "Competitor mentioned" |
| **Trend detection** | "Pain point X increased 40% this month" |

**Key principle:** Synthesis happens automatically. Users shouldn't have to "process" data.

### 3. ACT – Intelligence powers daily work

**This is the missing piece.** Today's UpSight is for analysis. Tomorrow's UpSight helps you act.

| Action | How UpSight Helps |
|--------|-------------------|
| **Reply to email** | "Here's context on this customer + suggested response" |
| **Prep for meeting** | "Brief: who they are, what they care about, what to ask" |
| **Follow up after call** | "Draft follow-up email based on meeting notes" |
| **Answer a question** | "Ask Chief of Staff: What do customers say about X?" |
| **Update stakeholders** | "Generate weekly summary of customer conversations" |

**Key interfaces:**
- **Email companion** – Chrome extension or sidebar showing customer context
- **Calendar integration** – Auto-generate meeting briefs
- **Meeting assistant** – Record, transcribe, extract action items
- **Chief of Staff chat** – Ask anything about any customer

**Key principle:** Intelligence should appear where you work, not in a separate app.

### 4. COMMUNICATE – Turn insights into artifacts

**What we have today:**
- ✅ Evidence pages
- ✅ Insights pages
- ✅ Themes pages
- 🚧 Video Collections (in progress)
- 🚧 Research Stories (planned)

**What we need:**
| Artifact | Audience | Purpose |
|----------|----------|---------|
| **Research Stories** | Internal team | Decision support with evidence |
| **Decision Reels** | Stakeholders | Video narratives that persuade |
| **Account Briefs** | Sales/CS | Everything about one customer |
| **Competitive Cards** | Sales | What customers say about competitors |
| **Testimonial Embeds** | Marketing | Social proof on website |
| **Case Studies** | Marketing/Sales | Success stories with real quotes |
| **Weekly Digests** | Team | What happened this week |
| **Board Decks** | Executives | Customer voice for investors |

**Key principle:** Same underlying data, different presentation for different audiences.

---

## The Chief of Staff

**Chief of Staff is the AI that knows everything about your customers.**

It has access to:
- Every email, call, meeting, ticket, survey
- All extracted evidence, themes, personas
- Key facts and metrics
- Account history and relationships

It can:
- Answer questions: "What do enterprise customers say about pricing?"
- Generate artifacts: "Create a story about why customers churn"
- Assist actions: "Draft a reply to this email"
- Surface alerts: "3 accounts mentioned competitor X this week"
- Prepare you: "Brief me for my 2pm call with Acme Corp"

**Chief of Staff is the interface to the platform.** Instead of navigating pages, you ask questions.

---

## Team Views

Different teams need different slices of the same intelligence:

### Product Team
- **Primary view:** Themes, feature requests, pain points
- **Key artifacts:** Decision Reels, prioritization evidence
- **Alerts:** "New pain point emerging" or "Feature request volume spike"

### Sales Team
- **Primary view:** Account briefs, competitive intel, objection patterns
- **Key artifacts:** Competitive cards, win/loss analysis
- **Alerts:** "Competitor mentioned in 5 calls this week"

### Customer Success
- **Primary view:** Account health, churn signals, expansion opportunities
- **Key artifacts:** Account briefs, renewal prep
- **Alerts:** "Churn risk detected" or "Upsell signal"

### Marketing
- **Primary view:** Testimonials, messaging themes, persona validation
- **Key artifacts:** Testimonial embeds, case studies, messaging docs
- **Alerts:** "New testimonial-worthy quote"

### Consulting/Services
- **Primary view:** Client feedback, deliverable validation
- **Key artifacts:** Stakeholder briefs, project summaries
- **Alerts:** "Client sentiment shift detected"

### Executives
- **Primary view:** Trends, health scores, strategic themes
- **Key artifacts:** Board decks, weekly digests, trend reports
- **Alerts:** "Significant pattern change"

---

## Competitive Positioning

### Current Landscape

```
                    ANALYSIS-FOCUSED
                          │
           Dovetail ●     │     ● Qualtrics
                          │
    ──────────────────────┼──────────────────────
    RESEARCH              │              OPERATIONAL
    (periodic)            │              (daily)
                          │
           UserTesting ●  │     ● Gong
                          │
                          │
                    ACTION-FOCUSED
```

**The gap:** No one combines deep research synthesis with daily operational support.

### Where UpSight Plays

```
                    ANALYSIS-FOCUSED
                          │
                          │     ● UpSight
                          │       (Research Stories,
                          │        Decision Reels)
    ──────────────────────┼──────────────────────
    RESEARCH              │              OPERATIONAL
                          │
                          │     ● UpSight
                          │       (Email assist,
                          │        Meeting prep)
                          │
                    ACTION-FOCUSED
```

**Our thesis:** The same platform that does deep research should power daily operations. They're not separate activities—they're the same customer knowledge applied differently.

### Why We Win

| Competitor | What They Do | Why We're Different |
|------------|--------------|---------------------|
| **Gong** | Sales call intelligence | We connect calls to everything else |
| **Dovetail** | Research repository | We power daily ops, not just analysis |
| **Notion** | Docs + wikis | We have customer intelligence, not just pages |
| **Superhuman** | Fast email | We have customer context, not just speed |
| **Salesforce** | CRM | We synthesize voice, not just track deals |

**The moat:** Once we're connected to email, calendar, meetings, and tickets, we have the full customer picture. No one else does.

---

## Phased Roadmap

### Phase 1: Foundation (Now - Q1)
**Theme:** Research + Stories

- ✅ Interviews + Ask Links
- ✅ Evidence extraction
- 🚧 Video Collections
- 🚧 AI Stories (v1.5)
- Decision Reels

**Outcome:** Best-in-class research synthesis and presentation.

### Phase 2: Daily Ops (Q2)
**Theme:** Work where you work

- Email integration (Gmail)
- Calendar integration (Google Calendar)
- Meeting recording for all calls (not just "interviews")
- Meeting prep briefs
- Follow-up drafts

**Outcome:** UpSight helps you before, during, and after customer interactions.

### Phase 3: Unified Intelligence (Q3)
**Theme:** Connect everything

- Gong/Chorus import
- Zendesk/Intercom import
- CRM sync (Salesforce, HubSpot)
- Account briefs
- Cross-source evidence linking

**Outcome:** Complete customer picture from all sources.

### Phase 4: Team Views (Q4)
**Theme:** Right intelligence for right team

- Sales view (competitive intel, objections)
- CS view (health, churn signals)
- Marketing view (testimonials, messaging)
- Alerts and digests
- Rich Stories (v2)

**Outcome:** Platform serves all customer-facing teams.

---

## Success Metrics

### Platform Health
| Metric | Target | Why |
|--------|--------|-----|
| Sources connected per account | 4+ | Platform value |
| Weekly active users | 60%+ of seats | Daily utility |
| Chief of Staff queries/week | 10+ per user | AI adoption |

### Capture
| Metric | Target | Why |
|--------|--------|-----|
| Emails synced | 1000+ per account/month | Coverage |
| Meetings recorded | 80%+ of customer calls | Completeness |
| Evidence extracted | 50+ items/week | Synthesis working |

### Act
| Metric | Target | Why |
|--------|--------|-----|
| Meeting briefs viewed | 70%+ of meetings | Prep utility |
| Email assists used | 20%+ of customer emails | Action utility |
| Follow-ups generated | 50%+ of meetings | Workflow fit |

### Communicate
| Metric | Target | Why |
|--------|--------|-----|
| Stories created | 2+ per account/month | Artifact creation |
| Embeds installed | 30%+ of accounts | External sharing |
| Artifacts shared | 5+ per account/month | Communication value |

---

## Open Questions

1. **Privacy:** How do we handle email/calendar access responsibly?
2. **Permissions:** Who can see what across the org?
3. **Pricing:** Do we charge per source? Per seat? Per usage?
4. **Build vs. integrate:** What do we build vs. connect to?
5. **Focus:** Do we go deep on one team first or broad across all?

---

## The Strategic Reframe

### Repositories Don't Sell. Outcomes Do.

**Wrong pitch:** "We help you store and analyze customer conversations."

**Right pitch:** "We help you win more deals, retain more customers, and ship what matters."

Companies don't want to **know** more. They want to **perform** better.

| What We Say | What They Hear |
|-------------|----------------|
| "Customer intelligence platform" | Another dashboard to ignore |
| "Research repository" | More work to maintain |
| "Evidence extraction" | Academic, not actionable |
| **"Never walk into a meeting unprepared"** | Immediate value |
| **"Reply to customers with full context"** | Daily time savings |
| **"Know which accounts need attention"** | Revenue protection |

### Daily Ops > Periodic Analysis

The primary value isn't quarterly research synthesis. It's **daily operational excellence:**

| Daily Pain | How UpSight Solves It |
|------------|----------------------|
| "I have a call in 30 min, who is this person?" | Auto-generated meeting brief |
| "What should I say in this email?" | Full context + suggested response |
| "What did we promise last call?" | Instant search across all interactions |
| "Is this account happy or at risk?" | Health score from all signals |
| "What should I follow up on today?" | AI-prioritized action list |

The research/stories/reels capabilities are **proof points** that emerge from doing daily ops well. If we're in every meeting and email, we automatically have the data to generate insights.

### The Wedge: Meeting Intelligence

**Start with meetings.** Every customer-facing team has them.

1. **Record** every customer meeting (not just "research interviews")
2. **Brief** before each call (who, context, what to ask)
3. **Summarize** after (key points, action items)
4. **Follow up** automatically (draft emails, tasks)

This is immediate, tangible, daily value. No "adoption" needed—just calendar access.

Once we're in meetings, we expand:
- "Also connect your email for full context"
- "Also connect support tickets to see issues"
- "Also connect CRM to track deals"

**The insight:** Meetings are the wedge. Everything else follows.

---

## The Bottom Line

**Today:** UpSight is a research repository with good AI extraction.

**Tomorrow:** UpSight is the customer intelligence platform that powers every customer interaction—before (prep), during (context), and after (follow-through)—from daily emails to board presentations.

**The pitch:** "Never walk into a customer meeting unprepared again."

**The unlock:** Calendar + meeting recording. That's where customer-facing work actually happens. Everything else (research, stories, reels) emerges from doing daily ops well.

**The moat:** Once we're in every customer meeting, we have the full picture. Synthesis and storytelling become features, not the product. The product is **being prepared and being effective**.
