# Insights Page Evolution: Use Case Analysis & Recommendation

> **Status**: Approved direction (2026-02-16)
> **Bead**: Insights-vmz8
> **Competitive Context**: Response to Listen Labs ($500M Sequoia-backed AI interview platform)
> **Next Step**: UX design session, then implementation spec

---

## 1. Strategic Context

The Insights page (`/insights`) is where UpSight's primary competitive moat — longitudinal synthesis + evidence traceability — becomes visible or invisible to users. Today it presents themes as a flat database table. It needs to become a story that helps users decide and act.

Two distinct use cases must be served:
- **Product teams**: Pattern detection across many customer voices
- **Consultants**: Stakeholder perspective integration across fewer, named individuals

This document analyzes whether those use cases converge or diverge, and recommends the architecture.

---

## 2. The Two Users, Mapped

| Dimension | Product Team User | Consulting User |
|-----------|-------------------|-----------------|
| **Who they are** | Founder/PM running customer interviews | Consultant running stakeholder interviews |
| **# of people** | 20-200 users/prospects | 5-15 stakeholders |
| **Relationship to subjects** | Mostly strangers, grouped by persona | Known individuals, each with a specific role |
| **What they need to see** | "What patterns emerge across many voices?" | "What does each person care about and where do they intersect?" |
| **Decision type** | "What should we build/fix?" (prioritize) | "How do we integrate these perspectives into a plan?" (synthesize) |
| **Output** | Feature priorities, roadmap inputs | Discovery brief, SOW inputs, recommendation deck |
| **Theme relationship** | Many people per theme | Few people per theme, but person context matters enormously |
| **Who cares about identity** | Mostly aggregate ("8 people said X") | Deeply individual ("The CTO said X, which conflicts with what HR said") |

**The fundamental difference**: Product teams think **theme-first, people-as-evidence**. Consultants think **people-first, themes-as-connective-tissue**.

---

## 3. Convergence / Divergence Analysis

### What They Share (Convergence)

Both use cases need:
1. **Themes with evidence counts** — already exists in `getInsights()`
2. **Person attribution on evidence** — exists via `evidence_facet`, `evidence_people`, `interview_people`
3. **Facet breakdowns** — exists in table view's segment columns
4. **Click-through to source evidence** — exists in insight detail page
5. **Actions from insights** — partially exists (create task)

### Where They Diverge

| Layer | Product Team | Consulting |
|-------|-------------|------------|
| **Primary axis** | Theme (horizontal: across people) | Person/Role (vertical: across themes) |
| **Aggregation** | "9 out of 14 people mentioned onboarding" | "Sarah (CTO) raised: migration, APIs, security" |
| **Comparison model** | Theme strength ranking | Stakeholder perspective comparison |
| **Gap analysis** | "What themes have low evidence?" | "What topics did nobody raise?" |
| **Trend question** | "Is this theme growing?" | "Did Sarah's concerns shift between interview 1 and 2?" |

### Verdict

**They converge at the data layer. They diverge at the presentation layer.**

This means: one page, two lenses — not two separate pages.

---

## 4. Recommendation: One Page, Two Lenses

### Why One Page

1. **Same data model underneath.** Both modes query themes + evidence + people + facets. The "By Stakeholder" view is a **pivot** of the same data, not new data.
2. **Users will switch.** A consultant will sometimes want "By Theme" to see what's emerging. A PM will sometimes want "what did this specific power user say?" The modes aren't user-type locked.
3. **Simpler mental model.** One place for synthesis.

### Why Lenses, Not Tabs

UpSight already has a lens architecture. This fits naturally:

```
[ By Theme ]  [ By Stakeholder ]  [ (future: By Timeline) ]
```

Lenses change *how you look at the same data*, not *which data you see*.

---

## 5. Shared Story Structure

Both lenses should follow the same **4-layer story structure**:

```
1. THE HEADLINE     — "What's the single most important thing?"
2. THE EVIDENCE     — Ranked/organized supporting data
3. THE GAPS         — What's missing or surprising
4. THE ACTIONS      — What should you do about it
```

### Mode 1: "By Theme"

| Story Layer | Content |
|-------------|---------|
| **Headline** | Top 3 themes by signal strength + trend direction. "Onboarding confusion is your #1 signal and growing." |
| **Evidence** | Theme cards ranked by strength. Each shows: evidence count, person count, trend arrow, top quotes preview. |
| **Gaps** | "These themes have few evidence points — investigate or dismiss?" + "Expected topics with no signal" (AI-generated). |
| **Actions** | Per-theme: Create Task, Run Follow-Up Survey, Share Brief, Dismiss. |

### Mode 2: "By Stakeholder"

| Story Layer | Content |
|-------------|---------|
| **Headline** | "You've heard from 8 stakeholders across 4 roles. Here's the landscape." + shared concerns callout. |
| **Evidence** | Person cards showing each stakeholder's top concerns (themes attributed to them). Listed by job_function/title. |
| **Gaps** | **Intersections**: "Timeline pressure was raised by 3/4 roles." + **Blind spots**: "No one mentioned end-user adoption readiness" (AI-generated). |
| **Actions** | "Generate Integration Brief" (export). "Follow Up With [Person]" (survey/schedule). "Flag Conflict" (mark real clashes). |

---

## 6. Scale Behavior

### The Core Principle

Below ~15 people: show individuals with title/function label. Never collapse individuals when identity matters.

Above ~15: auto-group by function, expandable to individuals.

### Consulting Sub-Groups

When multiple people share a function (e.g., 3 engineers: CTO, architect, dev), **list them individually by job_function/title**. Do NOT group them — each brings distinct perspective that consultants need to see. The CTO talks migration risk, the architect talks API contracts, the dev talks testing burden. That's three signals, not one.

### Scale Behavior Table

| Project Size | "By Stakeholder" Behavior |
|-------------|--------------------------|
| **1-15 people** (consulting) | Individual person cards listed by job_function/title. Full identity visible. |
| **15-50 people** (SMB product) | Group by role/persona. "Engineers (12)" → top concerns for group. Expandable to individuals. |
| **50+ people** (larger research) | Group by persona/segment. Becomes a persona view — conceptually right for product research at scale. |

Graceful degradation: individuals → role groups → personas based on count.

---

## 7. Architecture Assessment: What Exists vs. What's Needed

### Already Built

| Capability | Where It Lives |
|------------|---------------|
| Theme ↔ Evidence linking | `theme_evidence` junction table |
| Evidence ↔ Person attribution | `evidence_facet.person_id`, `evidence_people`, `interview_people` |
| Person facets (role, seniority, etc.) | `evidence_facet.kind_slug` + `person_facet` |
| Facet breakdown per theme | Table view's `getInsightSegments()` |
| Person → themes reverse query | `PersonInsights` component on person detail page |
| Person counts per theme | `getInsights()` already computes this |

### Needs Building

| Capability | Why It's Needed | Complexity |
|------------|-----------------|------------|
| **Bulk person → themes query** | Core of "By Stakeholder" mode. `PersonInsights` exists per-person, needs batch version for all project people. | Medium |
| **Theme trend over time** | "Growing/stable/fading" requires timestamped theme-evidence aggregation. Evidence has `created_at` but no temporal rollup today. | Medium |
| **Signal strength scoring** | Beyond count — weight by recency, person diversity, facet diversity. Replaces pure evidence count ranking. | Medium |
| **Blind spot detection** | AI-generated "expected topics not mentioned." Needs project type context. BAML prompt against existing theme list. | Medium |
| **Intersection detection** | "Which themes span multiple roles/people?" Partially in facet breakdown columns. Needs explicit surfacing. | Low |
| **Integration brief export** | Structured output combining all stakeholder perspectives + intersections + blind spots. Template + data assembly. | Medium |

### Key Architectural Insight

The "By Stakeholder" view is a **pivot, not new data**:

```
Current (By Theme):   Theme → evidence → people   ("how many people per theme?")
New (By Stakeholder): Person → evidence → themes   ("what themes per person?")
```

Both directions exist in the schema. The `PersonInsights` component already does the reverse query. "By Stakeholder" mode is essentially **running PersonInsights for every person in the project and laying them side by side**.

---

## 8. Phased Build Plan

### Phase A: Fix the Story (Both Modes Benefit)

Replace treemap + flat table with 4-layer story structure. Even for "By Theme" only, this transforms database → narrative.

- Headline section (top 3 themes by strength)
- Better theme ranking (signal strength, not just count)
- Action buttons per theme
- Kill the "UNCATEGORIZED (25)" flat list

### Phase B: Add "By Stakeholder" Lens

- Bulk `person → themes` query (adapt from PersonInsights)
- Person cards with top concerns, listed by job_function/title
- Auto-group threshold at ~15 people
- Intersection callout ("3/4 roles mentioned timeline pressure")

### Phase C: Intelligence Layer

- Temporal trends (evidence timestamp aggregation + sparklines)
- Blind spot detection (BAML prompt)
- Integration brief export
- Signal strength scoring formula

---

## 9. Naming Candidates

| Name | Vibe | Verdict |
|------|------|---------|
| **Insights** (keep) | Familiar | Keep as nav label. The page experience changes, not the name. |
| **Discovery Brief** | Consultant-native deliverable | Good for export/output naming, not page title. |
| **Signal** | Action-oriented | Strong candidate for the "Headline" section name. |
| **Pulse** | Temporal, living | Good if timeline becomes primary. |

Recommendation: Keep **"Insights"** as the page name. Use **"Signal"** or **"Discovery Brief"** for the export/share artifacts.

---

## 10. Consulting Use Case: Integration Model (NOT Consensus)

Critical framing decision captured from product discussion:

The consulting "By Stakeholder" model is **NOT** about alignment or consensus. It's about **integrating different perspectives**.

- CTO and HR talk about different facets of the same project in different language
- The value is seeing the full landscape, finding intersections, and spotting blind spots
- The consultant's job is to weave all perspectives into a coherent plan that acknowledges all of them
- "Conflict" should be flaggable but is not the default assumption — different concerns ≠ disagreement

This means the UI should present stakeholder perspectives as **complementary puzzle pieces**, not opposing positions. The intersections are interesting. The blind spots are actionable. The differences are expected and valuable.

---

*Analysis by Mary (Business Analyst) — 2026-02-16*
*Approved direction by Rick — 2026-02-16*
