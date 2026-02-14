# Card Sorting Exercise Plan

## Overview

Card sorting is a UX research method that reveals how users naturally categorize and label features. This exercise will validate our proposed navigation structure (Plan, Sources, Insights, CRM) before implementation.

## Objectives

1. **Validate navigation categories**: Do users group features the way we expect?
2. **Test naming conventions**: Are "Plan" and "Sources" understood intuitively?
3. **Discover mental models**: How do users think about research workflow stages?
4. **Identify ambiguity**: Which features lack clear homes in users' minds?

---

## Phase 1: Open Card Sort (Discovery)

### Goal
Understand how users naturally categorize UpSight features without guidance.

### Setup

| Parameter | Value |
|-----------|-------|
| **Participants** | 8-12 users (mix of power users + newer users) |
| **Method** | Remote, unmoderated |
| **Tool** | Optimal Workshop (recommended) or Maze |
| **Duration** | ~15 minutes per participant |

### Cards to Include

Create one card per feature/concept:

**Core Features**
- Surveys
- Conversations (Interviews)
- Notes
- Meeting Recordings
- Documents

**Research Planning**
- Company Context
- Research Goals
- Interview Prompts/Guide
- Tasks/Priorities

**Analysis & Synthesis**
- Evidence (Quotes/Receipts)
- Themes
- Custom Lenses
- Insights
- Reports

**CRM/People**
- People
- Organizations
- Opportunities
- Segments/Personas

**AI & Search**
- AI Chat Assistant
- Search
- Suggestions

### Instructions to Participants

> "Below are features from a customer research platform. Please group these items in a way that makes sense to you. You can create as many groups as you need. When you're done grouping, give each group a name that describes what the items have in common."

### Analysis

1. **Similarity matrix**: Which items are grouped together most often?
2. **Category names**: What labels do users naturally apply?
3. **Outliers**: Which items have no consistent home?
4. **Dendrogram**: Visualize clustering hierarchy

---

## Phase 2: Closed Card Sort (Validation)

### Goal
Test whether users can correctly place features into our proposed categories.

### Setup

| Parameter | Value |
|-----------|-------|
| **Participants** | Different 8-12 users (not Phase 1 participants) |
| **Method** | Remote, unmoderated |
| **Tool** | Same as Phase 1 |
| **Duration** | ~10 minutes per participant |

### Fixed Categories

Provide these four navigation categories as fixed destinations:

| Category | Description Shown |
|----------|-------------------|
| **Plan** | "Set up your research: context, goals, interview guides, priorities" |
| **Sources** | "Your raw materials: conversations, surveys, notes, documents" |
| **Insights** | "What you've learned: themes, findings, analysis" |
| **CRM** | "Who you're talking to: people, companies, opportunities" |

### Instructions to Participants

> "Place each item into the category where you would expect to find it. If you're unsure, place it where you would look first."

### Success Metrics

| Metric | Target |
|--------|--------|
| **Agreement rate** | > 70% consensus per item |
| **Completion rate** | > 90% participants finish |
| **Problematic items** | < 3 items with < 50% agreement |

### Red Flags to Watch

- Items split 50/50 between two categories = unclear IA
- Items with > 3 different placements = needs rethinking
- "Don't know" selections > 20% = confusing feature naming

---

## Phase 3: Tree Testing (Navigation Validation)

### Goal
Can users find specific features using our proposed navigation structure?

### Setup

| Parameter | Value |
|-----------|-------|
| **Participants** | 8-12 users (can overlap with Phase 2) |
| **Method** | Remote, unmoderated |
| **Tool** | Optimal Workshop Treejack or Maze |
| **Duration** | ~10 minutes per participant |

### Proposed Navigation Tree

```
Plan
├── Context (Company Info)
├── Research Goals
├── Interview Prompts
└── Tasks & Priorities

Sources
├── Conversations
├── Surveys
├── Notes
└── Documents

Insights
├── Top Themes
├── Evidence
├── Custom Lenses
└── Reports

CRM
├── People
├── Organizations
└── Opportunities
```

### Task Scenarios

| # | Task | Expected Path |
|---|------|---------------|
| 1 | "Find where you would set up questions for your next customer interview" | Plan → Interview Prompts |
| 2 | "Locate a quote from a customer about pricing concerns" | Insights → Evidence |
| 3 | "See a list of all the people you've interviewed" | CRM → People |
| 4 | "Review the major patterns emerging from your research" | Insights → Top Themes |
| 5 | "Find the recording of your meeting with Acme Corp" | Sources → Conversations |
| 6 | "Check what tasks are highest priority this week" | Plan → Tasks & Priorities |
| 7 | "Create a new survey to send to prospects" | Sources → Surveys |
| 8 | "See all deals in your pipeline" | CRM → Opportunities |

### Success Metrics

| Metric | Target |
|--------|--------|
| **Task success rate** | > 80% per task |
| **Directness** | > 70% (users go straight to answer without backtracking) |
| **Time to complete** | < 30 seconds average per task |

---

## Timeline

| Week | Activity | Owner |
|------|----------|-------|
| 1 | Prepare cards, recruit participants, set up tool | UX Lead |
| 2 | Run Phase 1 (Open Card Sort) | - |
| 3 | Analyze Phase 1 results, adjust categories if needed | UX + Product |
| 4 | Run Phase 2 (Closed Card Sort) + Phase 3 (Tree Test) | - |
| 5 | Synthesize findings, update IA, present recommendations | UX + Product |

---

## Tools Comparison

| Tool | Strengths | Cost |
|------|-----------|------|
| **Optimal Workshop** | Gold standard for card sorting, has all methods, excellent analysis | $99/mo+ |
| **Maze** | Good for combining with prototype testing | $99/mo+ |
| **UserZoom** | Enterprise-grade, great for large studies | Enterprise |
| **Miro/FigJam** | Free, good for moderated sessions | Free-$12/mo |

**Recommendation**: Optimal Workshop for unmoderated studies with proper analysis tools.

---

## Participant Recruitment

### Criteria

| Segment | Count | Criteria |
|---------|-------|----------|
| Power users | 4-5 | Using UpSight weekly for 2+ months |
| Newer users | 4-5 | Using UpSight < 1 month |
| Prospects | 2-3 | Haven't used UpSight but do customer research |

### Recruitment Sources

1. In-app notification to active users
2. Email to recent signups
3. User research panel (UserTesting, Respondent)

### Incentive

$25-50 gift card per participant (15-30 min total commitment)

---

## Deliverables

1. **Raw data export** from card sorting tool
2. **Similarity matrix visualization** showing clustering patterns
3. **Summary report** with:
   - Key findings per phase
   - Recommended IA changes
   - Problematic items requiring attention
   - Confidence level in proposed navigation
4. **Updated navigation specification** based on findings

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Low participation | Offer higher incentive, extend recruitment window |
| Biased sample (only power users) | Ensure mix of user types in recruitment criteria |
| Ambiguous card labels | Pre-test cards with 2-3 users before full study |
| Analysis paralysis | Define success metrics upfront, timebox analysis |

---

## Next Steps After Card Sorting

1. Update navigation wireframes based on findings
2. Build interactive prototype with validated IA
3. Conduct usability testing on prototype
4. Implement navigation changes in production
