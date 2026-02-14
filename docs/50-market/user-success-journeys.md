# User Success Journeys

> **Document Purpose**: Defines the critical user flows that must succeed for each persona to validate our positioning. Maps directly to brand brief personas and activation metrics.
> **Version**: 1.0 | **Date**: February 14, 2026
> **Status**: Active
> **Parent**: [Brand Brief](./brand-brief.md) (Section 5: Target Audience)

---

## How to Use This Document

Each journey maps a persona from **first touch to conviction** — the moment where they believe UpSight delivers on our promise. The product, onboarding, and engineering teams should use these journeys to:

1. **Prioritize features** that unblock the critical path
2. **Instrument metrics** at each stage (see activation metrics)
3. **Identify stall points** where users drop off
4. **Design interventions** (emails, nudges, UI changes) at failure points

---

## 1. The Consultant Journey (Beachhead)

### Hypothesis

Solo consultants and fractional execs who run 5+ stakeholder interviews per project will convert when they experience same-day synthesis that replaces 2-3 days of manual work.

### Persona Attributes (Testable)

| Attribute | Hypothesis | How to Validate |
|-----------|-----------|-----------------|
| **Role** | Solo consultant, fractional exec, boutique firm principal | Onboarding question |
| **Project frequency** | 2-4 client projects/quarter | Usage tracking |
| **Stakeholder interviews per project** | 5-15 interviews | Upload/recording count |
| **Current synthesis time** | 8-12 hours per project | Survey/interview |
| **Billing rate** | $150-300/hr | Self-reported or inferred |
| **Decision maker** | Buys alone, no procurement | Conversion speed |
| **Pain intensity** | High — synthesis is non-billable time eating into margins | Activation speed |
| **Tool stack** | Zoom/Meet + Google Docs/Notion + maybe Otter | Onboarding question |

### The Journey

```
ENTRY → SETUP → FIRST VALUE → CONVICTION → HABIT → ADVOCACY
```

#### Stage 1: Entry (Day 0)
**Trigger**: Consultant has a client project starting. Needs to run stakeholder interviews.

| Step | What Happens | Success Criteria | Stall Point |
|------|-------------|-----------------|-------------|
| 1.1 | Finds UpSight (LinkedIn, referral, SEO) | Lands on homepage or consultant landing page | - |
| 1.2 | Reads "From stakeholder interviews to undeniable recommendations" | Clicks CTA | Bounces — message doesn't resonate |
| 1.3 | Signs up | Account created | Signup friction |
| 1.4 | Voice-first onboarding: "Tell me about your project" | Project context captured | Skips setup, no context |

**Key metric**: Signup → project created (target: 90% same session)

#### Stage 2: First Value (Day 0-1)
**Goal**: Experience synthesis that would have taken days, in minutes.

| Step | What Happens | Success Criteria | Stall Point |
|------|-------------|-----------------|-------------|
| 2.1 | **Records or uploads first client meeting** | Conversation captured | "I'll do it later" — no content added |
| 2.2 | AI processes: transcription → evidence extraction → theme detection | Processing completes | Processing feels slow/broken |
| 2.3 | **Views evidence with source links** | Clicks "show source" on at least one finding | Doesn't explore results |
| 2.4 | Sees themes across stakeholders | Recognizes pattern they noticed manually | Results feel generic/wrong |

**Key metric**: Time to first evidence view (target: < 33 minutes from signup)

**Critical onboarding hook**: Real-time meeting recorder joins their next client call automatically (via calendar integration) or they upload a recent recording. Either way, they get synthesis *for a real project* on day one.

#### Stage 3: Conviction (Day 1-7)
**Goal**: "This would have taken me 3 days. It took 30 minutes."

| Step | What Happens | Success Criteria | Stall Point |
|------|-------------|-----------------|-------------|
| 3.1 | Uploads 2-3 more stakeholder interviews | Multiple sources synthesized | Stops after one |
| 3.2 | **Cross-stakeholder synthesis**: sees where stakeholders agree/disagree | "3 of 5 stakeholders mentioned budget concerns" | Doesn't see cross-interview patterns |
| 3.3 | Uses evidence in client deliverable (SOW, findings report) | Copies/exports insights with attribution | No clear export path |
| 3.4 | **Receipts moment**: Client challenges a recommendation, consultant clicks → shows source | Defensibility proven | Never gets challenged (can't prove value) |

**Key metric**: 3+ conversations uploaded in first 7 days (target: 60% of consultants)

**Conviction signal**: "This is what I've been doing manually" (recognition of existing workflow, automated)

#### Stage 4: Habit (Day 7-30)
**Goal**: UpSight becomes part of every client engagement.

| Step | What Happens | Success Criteria | Stall Point |
|------|-------------|-----------------|-------------|
| 4.1 | Creates second project (new client) | Multi-project usage | One-and-done |
| 4.2 | Develops personal workflow (record → review → export) | Consistent usage pattern | Reverts to old tools |
| 4.3 | Upgrades to paid plan | Conversion | "Not worth paying for" |

**Key metric**: 2nd project created within 30 days (target: 50%)

#### Stage 5: Advocacy (Day 30+)
**Goal**: Consultant recommends to peers.

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 5.1 | Mentions UpSight to another consultant | Word-of-mouth referral |
| 5.2 | Shares a finding with attribution visible | Client sees the product indirectly |

**Key metric**: Referral rate (target: 30% of active users)

### ROI Proof Point

```
WITHOUT UPSIGHT                    WITH UPSIGHT
═══════════════                    ════════════
8 stakeholder interviews           8 stakeholder interviews
↓                                  ↓
3 days manual synthesis            30 min AI synthesis
(8-12 hours @ $200/hr)             (review + refine: 2 hours)
↓                                  ↓
Cost: $1,600-2,400                 Cost: $400 + $99/mo subscription
non-billable time                  ↓
                                   Net savings: $1,100-1,900/project
```

---

## 2. The Founder Journey (Fast-Follow)

### Hypothesis

Founders at 5-30 person companies who talk to customers weekly will convert when they see patterns across conversations they couldn't see before — and can share evidence with their team to end debates.

### Persona Attributes (Testable)

| Attribute | Hypothesis | How to Validate |
|-----------|-----------|-----------------|
| **Role** | CEO/founder, often solo decision-maker on tools | Onboarding question |
| **Company stage** | Post-launch, 5-30 employees, seed to Series A | Self-reported |
| **Customer contact** | Weekly (calls, demos, support) | Usage frequency |
| **Current process** | Notes in head, Notion, or nowhere | Onboarding question |
| **Pain** | "I know what customers want but can't prove it to my team" | Activation behavior |
| **Budget** | $50-200/mo for tools | Plan selection |
| **Decision speed** | Fast — buys and tries in same session | Time to signup |

### The Journey

#### Stage 1: Entry (Day 0)
**Trigger**: Another team debate about what to build. Founder thinks "there has to be a better way."

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 1.1 | Finds UpSight via Product Hunt, community, or SEO | Lands on homepage |
| 1.2 | Hero resonates: "Get your customers. Build conviction." | Clicks "Start seeing your customers" |
| 1.3 | Signs up, voice-first setup: "What are you trying to learn about your customers?" | Project created with goals |

#### Stage 2: First Value (Day 0-3)
**Two entry paths:**

**Path A: Upload existing conversations**
| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 2A.1 | Uploads 2-3 recent customer call recordings | Content ingested |
| 2A.2 | AI finds patterns they already knew (validation) AND patterns they didn't (discovery) | "I didn't realize 3 customers mentioned the same thing" |
| 2A.3 | Clicks an insight → sees exact quote from specific customer | "Receipts" moment |

**Path B: Smart survey**
| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 2B.1 | Creates AI-generated survey from research goal | Survey link ready to share |
| 2B.2 | Shares with 5-10 customers | Responses arrive |
| 2B.3 | AI synthesizes responses into themes | Patterns visible |

**Key metric**: Time to first pattern recognition (target: < 1 hour from first content)

#### Stage 3: Conviction (Day 3-14)
**Goal**: Uses evidence in a team decision.

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 3.1 | Shares a finding with a co-founder or team member | First shared insight |
| 3.2 | Uses evidence in a product/roadmap discussion | "Here's what 4 customers said about X" |
| 3.3 | Team member asks "where did you get that?" → shows UpSight | Internal advocacy |

**Conviction signal**: Founder stops saying "I think customers want" and starts saying "customers told us"

#### Stage 4: Habit (Day 14-30)
| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 4.1 | Records/uploads new conversations as they happen | Weekly usage |
| 4.2 | Invites 1-2 team members | Team expansion |
| 4.3 | Upgrades to paid plan | Conversion |

**Key metric**: Team member invited within 30 days (target: 40%)

---

## 3. The Post-Launch Founder Journey (High Urgency)

### Hypothesis

Founders who shipped but have weak traction are the highest-urgency, highest-willingness-to-pay segment because they need to make a pivot-or-persevere decision before runway runs out.

### Persona Attributes (Testable)

| Attribute | Hypothesis | How to Validate |
|-----------|-----------|-----------------|
| **Role** | Technical or product-focused founder | Self-reported |
| **Company stage** | Post-launch, <$10K MRR, <18 months runway | Inferred from behavior |
| **Existing data** | Has 10-30 customer conversations they haven't fully analyzed | Upload volume on day 1 |
| **Urgency** | Very high — needs clarity in days, not weeks | Time to first upload |
| **Pain** | "I don't know if we should pivot or push harder" | Research goal phrasing |
| **Willingness to pay** | High (desperate for signal) | Conversion speed |

### The Journey

#### Stage 1: Entry (Day 0)
**Trigger**: Board meeting in 2 weeks, needs to show customer evidence for direction.

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 1.1 | Finds UpSight searching "how to synthesize customer interviews" or "customer discovery tool" | Organic/SEO entry |
| 1.2 | Reads "Find what customers are trying to tell you" | Clicks "Upload your conversations" |
| 1.3 | Signs up, skips extensive setup, goes straight to upload | Fast path to content |

#### Stage 2: First Value (Day 0-1)
**Goal**: Bulk upload existing conversations and get cross-conversation synthesis.

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 2.1 | Uploads 5-10 existing recordings/transcripts | Batch upload succeeds |
| 2.2 | AI processes all and finds cross-conversation patterns | Themes surface within hours |
| 2.3 | **Discovery moment**: "4 of 8 customers mentioned X as their biggest pain — I thought it was Y" | Assumption challenged by evidence |
| 2.4 | Clicks theme → sees every customer who mentioned it with exact quotes | Evidence chain verified |

**Key metric**: 5+ conversations uploaded in first session (target: 70% of this segment)

#### Stage 3: Conviction (Day 1-3)
**Goal**: Uses evidence to make (or support) a strategic decision.

| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 3.1 | Exports findings or screenshots evidence for board deck | Evidence used externally |
| 3.2 | Makes a pivot/persevere decision backed by customer evidence | Strategic decision made |
| 3.3 | "This would have taken me 2 weeks to figure out" | Value recognized |

**Conviction signal**: Fast conversion (often within first week)

---

## 4. The Product Lead Journey (Secondary)

### Hypothesis

Product leads without dedicated research teams will convert when UpSight gives them the research infrastructure they need without the overhead of tools like Dovetail (built for research ops teams).

### Persona Attributes (Testable)

| Attribute | Hypothesis | How to Validate |
|-----------|-----------|-----------------|
| **Role** | PM, product lead, head of product | Onboarding question |
| **Team size** | 10-50 total company, no UX researcher | Self-reported |
| **Research frequency** | Bi-weekly to monthly | Usage pattern |
| **Current process** | Notion + Zoom recordings + maybe Looppanel | Tool stack question |
| **Pain** | "I do research but nobody sees it or acts on it" | Research goal phrasing |
| **Budget authority** | Usually can buy tools < $100/mo without approval | Conversion friction |

### The Journey

#### Stage 1: Entry
**Trigger**: Shipped a feature that flopped. "We should have talked to customers first."

#### Stage 2: First Value (Day 0-7)
| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 2.1 | Uploads 2-3 customer interviews for current project | Content ingested |
| 2.2 | AI extracts themes and links to evidence | Patterns surface |
| 2.3 | Shares insight with engineering lead: "Here's what 3 customers said about this feature" | Evidence shared internally |

#### Stage 3: Conviction
| Step | What Happens | Success Criteria |
|------|-------------|-----------------|
| 3.1 | Uses evidence to prioritize backlog item | Research drives roadmap |
| 3.2 | Creates task from insight | Research → action connection |
| 3.3 | "This is the research system I needed" | Retention |

**Key metric**: Insight shared with team member within 14 days (target: 50%)

---

## 5. Activation Metrics (Cross-Persona)

### Definition of "Activated"

A user is **activated** when they have completed all three:
1. **Added content** — uploaded, recorded, or received survey responses
2. **Viewed analysis** — looked at evidence, themes, or insights
3. **Took action** — shared, exported, created task, or used evidence in a decision

### Key Metrics

| Metric | Target | Current | Measurement |
|--------|--------|---------|-------------|
| **Activation Rate (D14)** | 35%+ | Unknown | % signups completing all 3 activation steps |
| **Time to Activation** | < 7 days | Unknown | Median days to activation |
| **Time to First Insight** | < 33 min | Unknown | Signup → first evidence view |
| **Trial → Paid Conversion** | 25%+ | Unknown | % trial users upgrading |
| **30-Day Retention** | 40%+ | Unknown | % users active at D30 |
| **Team Expansion Rate** | 30%+ | Unknown | % users inviting teammates |

### Stall Points & Interventions

| Stall Point | Signal | Intervention |
|-------------|--------|-------------|
| **Signed up, no content** | D2+ with 0 uploads/recordings | Email: "Record your next meeting" + calendar integration prompt |
| **Content added, never viewed results** | Analysis complete, D1+ without viewing | Email: "See what we found in your conversations" |
| **Viewed results, no action** | Insights seen, no share/export/task | In-app: "Share this finding with your team" nudge |
| **One project, never created second** | D14+ with single project | Email: "Start your next project" with template |
| **Active but not paying** | D14+ active, no upgrade | Reverse trial: grant Pro features, countdown to expiry |

### Activation Paths

| Path | Steps | Persona Fit |
|------|-------|------------|
| **Conversation Path** | Upload → View evidence → Share finding | Consultants, founders |
| **Survey Path** | Create survey → Get responses → View themes | Product leads, founders |
| **Bulk Upload Path** | Upload 5+ conversations → Cross-conversation synthesis | Post-launch founders |
| **Live Recording Path** | Record meeting → Same-day synthesis | Consultants |

---

## 6. Steps to Wow (Implemented)

The product currently implements two "Steps to Wow" paths that map to the journeys above:

### Discover Path (Blue)
Maps to: **Conversation Path** activation

| Step | Action | Completion Signal |
|------|--------|------------------|
| 1 | Upload a conversation | `encounters > 0` |
| 2 | See what AI found (themes, pain points, quotes) | `themes > 0` |
| 3 | Click an insight — see the receipts | `insights > 0` |

### Reach Out Path (Amber)
Maps to: **Survey Path** activation

| Step | Action | Completion Signal |
|------|--------|------------------|
| 1 | Send a smart survey | `surveys > 0` |
| 2 | Watch responses roll in | `surveyResponses > 0` |
| 3 | See patterns with receipts | `themes > 0` |

### Full Journey Map (4 Phases)
For users who skip Steps to Wow:

1. **Get Set Up**: Context & Goals, Create Survey, Upload Contacts
2. **Gather Sources**: Upload, Record, Add Notes, Review Evidence
3. **Find Patterns**: Explore Themes, Create Insights
4. **Take Action**: Share Finding, Create Task

---

## 7. Journey Gaps & Priorities

### What's Working
- Steps to Wow paths are implemented and map well to activation
- Voice-first onboarding captures project context
- Evidence traceability ("receipts") is the consistent wow moment across all personas

### What's Missing

| Gap | Impact | Priority | Persona |
|-----|--------|----------|---------|
| **Calendar integration for auto-recording** | Consultants need zero-effort capture | P0 | Consultant |
| **Bulk upload flow** | Post-launch founders have 10+ existing recordings | P1 | Post-launch founder |
| **Export to doc/PDF with evidence links** | Consultants need client-ready output | P1 | Consultant |
| **Cross-conversation synthesis view** | "3 of 5 stakeholders said X" pattern | P1 | Consultant, founder |
| **Team sharing/invite flow** | Founders need to share with team for conviction | P1 | Founder |
| **Consultant landing page** | No dedicated entry point for beachhead ICP | P1 | Consultant |
| **Stakeholder role tagging** | Consultant wants role-based analysis (exec vs. user) | P2 | Consultant |
| **Board deck export** | Post-launch founders need evidence for investors | P2 | Post-launch founder |

### Measurement Plan

For each journey, instrument these events (see `docs/70-PLG/strategy/instrumentation-plan.md`):

| Event | Maps To |
|-------|---------|
| `account_signed_up` | Entry |
| `project_created` | Setup |
| `interview_added` / `survey_created` | First content |
| `analysis_viewed` | First value |
| `evidence_clicked` | Receipts moment |
| `insight_shared` / `task_created` | Action taken |
| `project_created` (2nd) | Habit |
| `plan_upgraded` | Conversion |
| `invite_sent` | Expansion |

---

## 8. Validation Criteria

### How We Know the Positioning Works

| Signal | Target | Timeframe |
|--------|--------|-----------|
| Consultant conversion rate | 15%+ of consultant signups → paid | 60 days |
| Consultant reuse | 50%+ create 2nd project | 30 days |
| Founder team expansion | 40%+ invite a team member | 30 days |
| Post-launch founder speed | 70%+ upload 5+ conversations day 1 | Ongoing |
| Overall activation rate | 35%+ reach activated state | D14 |
| Referral rate | 30%+ of active users refer someone | 90 days |

### Decision Rule

| Signal | Action |
|--------|--------|
| 5+ consultants convert and reuse within 60 days | Invest in consulting-specific features (SOW generator, stakeholder matrix) |
| Weak consultant adoption after 60 days | Keep as secondary segment, focus on founders |
| Post-launch founders activate faster than any other segment | Double down with dedicated landing page and SEO |

---

*This document maps directly to the [Brand Brief](./brand-brief.md) personas and the [Activation Strategy](../70-PLG/strategy/activation-strategy.md). Update when persona hypotheses are validated or invalidated.*
