# UpSight Positioning & Experience Doc

## 1. Product + ICP

**Product**
UpSight = “shared reality from customer conversations.”
Insight layer on top of calls, notes, tickets, docs.

**Primary ICP**
B2B SaaS companies (20–500 employees) with distributed teams across product, sales, and CS who:

- Run lots of customer conversations.
- Have data scattered across tools.
- Struggle to turn it into shared, usable insight.

**Secondary personas**

- **Sales / CS / RevOps leaders**
  Need one source of truth on what customers are saying across deals and accounts.
- **Product / UX / Research leads**
  Want a continuous, lightweight insight engine, not one-off studies.

---

## 2. Core Problem & Promise

**Problem (knife sentence)**
Teams talk to customers all day, but insight stays trapped in scattered tools, people’s heads, and noisy AI output—so decisions still rely on anecdotes and hero reps.

**Symptoms**

- Calls in Gong/Zoom; notes in docs and DMs; tickets in support tools.
- AI tools create more text, not more alignment.
- Cross-functional teams lack a single picture of the customer.
- Result: repeated discovery, slow decisions, endless “we heard…” debates.

**Promise / Value prop**

> UpSight turns your customer conversations and data into a shared, real-time insight layer for your team—so sales, product, and CS can act on the same customer truth.

**Key outcomes**

- **Clarity** – What customers actually say, in one place, tied to goals.
- **Alignment** – Shared view of patterns, per-role lenses.
- **Action** – Insights flow into owned, trackable next steps.

---

## 3. Brand Archetype + Voice

**Primary archetype: Guide / Sage**

- Calm, experienced operator.
- Explains the mess in simple terms.
- Evidence-based, not hype.
- You (user) are the hero; UpSight is the guide.

**Voice**

- Sound like a seasoned Head of Product / RevOps.
- Plain language; low drama.
- “Here’s what’s really happening and what to do next.”

**Do**

- “Here’s what changed this week in your customer conversations.”
- “These three themes keep showing up in mid-market calls.”
- “Start with one project and five conversations.”

**Don’t**

- “Crush your market with AI superpowers.”
- “Dominate every conversation with magical insight.”

---

## 4. Mental Model

**Loop:** `Prepare → Connect → Collect → Synthesize → Act`

This is the *story spine* for:

- Website copy.
- Onboarding.
- Navigation.
- Empty states.

### 4.1 Prepare – Align what you’re trying to learn

- Define projects around decisions (e.g. churn, new segment, pricing).
- Capture goals, bets, and decision questions.
- Generate interview guides and surveys tied to those goals.

**Pain killed:** random conversations with no clear purpose.

### 4.2 Connect – Recruit the right voices, humanely

- Manage people and orgs to learn from.
- Invite via email, links, embedded forms.
- Offer choice of mode: survey, bot chat, live call.
- Handle incentives + time expectations.

**Pain killed:** ad-hoc recruiting in inboxes; no system of “who we spoke with and why.”

### 4.3 Collect – Capture conversations and context in one place

- Ingest recordings, transcripts, notes, tickets, docs.
- Auto-tag by person, account, project, goal.
- Keep raw evidence attached to its source.

**Pain killed:** hunting across 5+ tools for “what did they say?”

### 4.4 Synthesize – From noise to shared signal

- AI groups evidence into themes tied to goals.
- Per-role lenses:
  - Sales → deal blockers, objections, triggers.
  - Product → feature gaps, UX issues, unmet needs.
  - CS → churn risks, success patterns.
- Weekly digests and alerts vs static reports.

**Pain killed:** manual deck/Notion synthesis; monthly “what did we learn?” fire drills.

### 4.5 Act – Turn insight into owned next steps

- Create actions directly from insights.
- Assign owners and time windows.
- Keep evidence attached (quotes, clips, docs).
- Agentic AI drafts outreach, experiments, briefs; humans approve.

**Pain killed:** insights dying in docs/slide decks.

---

## 5. Information Architecture (IA)

Top-level nav aligned to the mental model (but in “normal product words”):

- **Projects** (Prepare)
- **People** (Connect)
- **Evidence** (Collect)
- **Insights** (Synthesize)
- **Actions** (Act)

### 5.1 IA Table

| Step        | Nav        | Primary owner(s)               | Key artifacts                               |
|------------|------------|---------------------------------|---------------------------------------------|
| Prepare    | Projects   | Founder, PM, RevOps, CS lead   | Projects, decision questions, goals, guides |
| Connect    | People     | Sales, CS, PM, founder         | People, orgs, invites, recruiting templates |
| Collect    | Evidence   | Anyone talking to customers    | Recordings, transcripts, notes, tickets, docs |
| Synthesize | Insights   | Product, RevOps, leadership    | Themes, insights, digests                   |
| Act        | Actions    | Managers & ICs across teams    | Tasks, experiments, playbooks               |

---

## 6. Key Flows

### 6.1 “Start a project and run 5 conversations”

1. **Create project (Projects / Prepare)**
   - User adds name, decision question, goal.
   - UpSight suggests segments and example questions.
   - AI generates a draft interview/survey guide.

2. **Add people (People / Connect)**
   - User imports from CRM or manually adds contacts.
   - UpSight suggests ideal profiles from existing data.

3. **Invite participants (Connect flow)**
   - User opens “Invite participants” for the project.
   - Choose invite template:
     - 2-min survey
     - 3–5 min bot chat
     - 5–10 min live call
   - UpSight generates email with three options and links.
   - User sends via email tool or copy-paste.

4. **Capture evidence (Evidence / Collect)**
   - Live calls are recorded + transcribed.
   - Bot/survey answers stored as structured evidence.
   - Manual notes can be pasted in.
   - All tied to the project and person.

5. **Generate insights (Insights / Synthesize)**
   - User hits “Analyze my latest evidence.”
   - UpSight surfaces themes and examples.
   - User can rename, merge, discard themes.
   - Insights can be pinned or shared.

6. **Create actions (Actions / Act)**
   - From an insight, user clicks “Create action.”
   - Set title, owner, time window, impact area.
   - AI can draft email, brief, or experiment outline.
   - Actions show up in the Actions board and in project view.

Additional user flows:

* add notes and other content relevant to people, orgs or the project in general
* voice/text chat with Uppy Assistant to gain insights
* voice/text chat to modify records on anything, even create "docs" and "emails" example docs include: market positioning, competitive briefs, objection handling, email templates for different cases
* create/modify tasks, interact with them via text/voice, including assigning tasks to different users with deadlines, discuss/debate with AI priorities, logic, best next steps
* ability for user to create questions in the project for external sharing to get feedback via text, voice, or schedule a meeting. See specific PRD on this.
* Create opportunities and manage them like any CRM (pending PRD)

---

## 7. Landing Page Outline (Externally Facing)

### Hero

- **Headline:** “Turn customer conversations into shared reality”
- **Subheadline:** “UpSight connects your calls, notes, and feedback into one insight layer for sales, product, and CS—so everyone acts on the same customer truth.”
- **Primary CTA:** “Start a free discovery project”
- **Secondary CTA:** “Watch 2-minute demo”

### Problem section

- Title: “You talk to customers all day. Insight is still scattered.”
- Bullets: Calls/notes/tickets/AI summaries in silos.
- Outcome: repeated discovery, slow decisions, “we heard…” arguments.

### What UpSight does

3 outcomes: Clarity, Alignment, Action.

### How it works: 5-step loop

Short cards or horizontal steps corresponding to Prepare → Connect → Collect → Synthesize → Act.

### For whom

Three columns: Founders & Product, Sales & CS, RevOps & Research.

### Humane recruiting differentiator

Explain “3 ways to share feedback” pattern and respect for customer time.

### Final CTA

“Start with one project and five conversations.”

---

## 8. Design Principles

- **Human-first, AI-assisted** – AI proposes; humans decide.
- **Evidence-backed** – every insight can show its receipts.
- **Right time, right depth** – TL;DR first, detail on demand.
- **Shared source, personal lens** – one truth, tailored views.
- **Guide/Sage tone** – calm, clear, low ego.
