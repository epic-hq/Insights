# Lens-Based Architecture V2

## Executive Summary

**The Shift:** From pre-defined personas and rigid research hierarchies to **evidence-first, lens-driven insights** where user groups emerge from data and different stakeholders see what they need.

**Core Principle:** The same evidence can be viewed through different "lenses" that apply appropriate frameworks and generate outputs tailored to specific decision-making contexts (Product, Sales, Research, etc.).

---

## The Problems We're Solving

### 1. **Persona Chicken-and-Egg Problem**
- Current: Evidence is tagged with personas before personas are validated
- Reality: Personas should emerge from clustering people by attributes and behavioral patterns
- Fix: People → Attributes → Derived Groups (Role/Segment/Persona)

### 2. **Research Hierarchy Doesn't Serve Business Users**
- Current: Goal → DQ → RQ works for researchers but not PMs/Sales
- Reality: PMs want "what pain to solve for which user type"
- Sales wants "is this deal qualified and how do I move it forward"
- Fix: Multiple lenses, each with appropriate outputs

### 3. **Themes Are Too Granular**
- Current: 30+ micro-themes with sparse evidence
- Reality: Need consolidation and minimum thresholds
- Fix: Lens-specific theme clustering with evidence minimums

### 4. **No Clear Path from Evidence to Action**
- Current: See themes and personas, but "so what?"
- Reality: Need clear decision matrices (pain × user type, feature × willingness to pay)
- Fix: Lens-specific output formats (matrices, scorecards, backlogs)

---

## New Architecture: Evidence → Lenses → Insights → Actions

```
┌─────────────────────────────────────────────────────────┐
│                    RAW INPUTS                           │
├─────────────────────────────────────────────────────────┤
│ Interviews → Transcripts → Evidence (atomic units)      │
│ People → Attributes (role, segment, behaviors)          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                DERIVED GROUPINGS                         │
├─────────────────────────────────────────────────────────┤
│ People Clustering → Roles, Segments, Personas           │
│ Evidence Clustering → Themes (by context/lens)          │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┬────────┬─────────┐
        │        │        │        │         │
        ▼        ▼        ▼        ▼         ▼
┌─────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌───────┐
│Research │ │Product │ │Sales │ │Support│ │ ...   │
│  Lens   │ │  Lens  │ │ Lens │ │ Lens  │ │Custom │
└────┬────┘ └────┬───┘ └───┬──┘ └───┬───┘ └───┬───┘
     │           │         │        │         │
     ▼           ▼         ▼        ▼         ▼
┌─────────────────────────────────────────────────────┐
│           LENS-SPECIFIC OUTPUTS                     │
├─────────────────────────────────────────────────────┤
│ Research: Goal/DQ/RQ hierarchy, Answer confidence   │
│ Product:  Pain × User Type matrix, Feature backlog  │
│ Sales:    BANT scorecard, Deal qualification       │
│ Support:  Issue × Segment matrix, FAQ candidates    │
└─────────────────────────────────────────────────────┘
```

---

## Core Entities (Revised)

### 1. Evidence (Atomic, Lens-Agnostic)
```typescript
{
  id: string
  verbatim: string
  source: { interview_id, person_id, anchor }
  facets: {  // Structured attributes
    pain?: string[]
    goal?: string[]
    workflow?: string[]
    constraint?: string[]
    willingness_to_pay?: "high" | "medium" | "low"
    priority?: "critical" | "important" | "nice-to-have"
  }
  metadata: {
    confidence: number
    source_type: "primary" | "secondary"
    modality: "qual" | "quant"
  }
}
```

**Key Change:** Evidence is NOT pre-tagged with personas. It's tagged with observable facets.

### 2. People & Derived Groups
```typescript
// Person (Observed Attributes)
{
  id: string
  name: string
  attributes: {
    role: string           // Observed: "Product Manager", "Developer"
    segment: string        // Observed: "Enterprise", "SMB"
    company_size: string
    industry: string
    behaviors: string[]    // "Uses competitor X", "Manages team >5"
    pain_intensity: Record<string, "high" | "medium" | "low">
  }
}

// Derived Groups (Emergent, Not Pre-Defined)
{
  type: "role" | "segment" | "persona" | "cohort"
  name: string  // "Enterprise PM", "Technical Buyer", "Price-Sensitive SMB"
  criteria: {   // How to identify members
    role_in?: string[]
    segment_in?: string[]
    behaviors_all?: string[]
    behaviors_any?: string[]
  }
  members: person_id[]  // Computed, not stored
}
```

**Key Change:** Groups are derived from attributes via clustering/rules, not manually assigned upfront.

### 3. Themes (Lens-Contextualized)
```typescript
{
  id: string
  name: string
  lens_context: "product" | "sales" | "support" | null  // null = cross-lens
  statement: string
  evidence_ids: string[]
  min_evidence_threshold: number  // e.g., 3 for product, 1 for sales
  inclusion_criteria: string
  exclusion_criteria: string
}
```

**Key Change:** Themes can be scoped to specific lenses with different thresholds.

---

## Lens Definitions

### Lens: Product / User Research

**Job:** Validate what pain to solve for which user types, prioritize features

**Inputs:**
- Evidence with pain/goal/workflow facets
- People grouped by role/segment
- Willingness to pay signals

**Process:**
1. Cluster evidence into pain themes (min 3 evidence pieces)
2. Map pain themes to user types (role/segment/persona)
3. Score each cell by:
   - **Frequency:** % of user type mentioning this pain
   - **Intensity:** Average priority rating from evidence
   - **Willingness to Pay:** % who'd pay to solve it

**Output Format: Pain × User Type Matrix**
```
Pain/Need                    | Enterprise PM | SMB Designer | Developer
─────────────────────────────|───────────────|──────────────|──────────
Can't organize research      | 🔥🔥🔥 85%    | 🔥 45%       | — 10%
  • Priority: Critical       | WTP: High     | WTP: Medium  | WTP: Low
  • Evidence: 12 pieces      | Freq: 8/10    | Freq: 3/8    | Freq: 1/6
─────────────────────────────|───────────────|──────────────|──────────
Hard to share insights       | 🔥🔥 60%      | 🔥🔥 70%     | 🔥 40%
  • Priority: Important      | WTP: Medium   | WTP: High    | WTP: Low
  • Evidence: 8 pieces       | Freq: 6/10    | Freq: 5/8    | Freq: 2/6
─────────────────────────────|───────────────|──────────────|──────────
[more rows...]
```

**Actions Generated:**
- Feature backlog with evidence links
- Prioritization by (frequency × intensity × WTP)
- Segment-specific messaging

### Lens: Sales Qualification

**Job:** Determine if opportunity is qualified and how to advance it

**Inputs:**
- Evidence with budget/authority/need/timeline signals
- Company/deal metadata
- Stakeholder mapping

**Process:**
1. Extract BANT/MEDDIC criteria from evidence
2. Score qualification dimensions
3. Identify gaps and next steps

**Output Format: Qualification Scorecard**
```
Deal: ACME Corp                           Status: 🟡 Qualified with Gaps
─────────────────────────────────────────────────────────────────────
BANT Framework                 Score    Evidence                   Gap
─────────────────────────────────────────────────────────────────────
Budget                         ✅ 90%   "We have $200K allocated"  None
Authority                      🟡 60%   "Need CFO approval"        Connect w/ CFO
Need                           ✅ 85%   "Spending 20hrs/week..."   None
Timeline                       🟡 50%   "This quarter ideally"     Unclear deadline
─────────────────────────────────────────────────────────────────────
Overall Qualification: 71%                Action: Schedule CFO intro
```

**Actions Generated:**
- Gap-closing tasks
- Stakeholder engagement plan
- Deal risk assessment

### Lens: Research Hierarchy (For Researchers)

**Job:** Answer structured research questions with confidence

**Inputs:**
- Goal → Decision Questions → Research Questions
- Evidence linked to RQs
- Cross-RQ synthesis requirements

**Process:**
1. Link evidence to RQs (provenance)
2. Synthesize RQ findings from evidence
3. Synthesize DQ insights from RQ findings
4. Assess confidence and coverage

**Output Format: Hierarchical Answers**
```
Goal: Determine monetization model
├─ DQ: What will users pay for?
│  ├─ Strategic Insight: "Freemium with premium interview features"
│  ├─ Confidence: High (82%)
│  ├─ Actions: [Build free tier, Create premium upsell, Price at $29/mo]
│  └─ Supporting RQs:
│     ├─ RQ: What features are must-haves?
│     │  └─ Findings: "Interview tools: 8/10 users, high confidence"
│     └─ RQ: What's willingness to pay?
│        └─ Findings: "$20-50/mo acceptable: 6/10 users"
```

**Actions Generated:**
- Research gap identification
- Next interview prompts
- Confidence improvement plan

---

## Implementation: Phase 1

### 1. Evidence Processing (No Changes)
- Continue extracting faceted evidence from interviews
- **Remove** persona pre-tagging from evidence extraction
- **Add** willingness_to_pay and priority to facet extraction

### 2. People → Group Derivation
```typescript
// New service: deriveUserGroups()
export async function deriveUserGroups(projectId: string) {
  const people = await getPeopleWithAttributes(projectId)

  // Rule-based grouping
  const groups = {
    byRole: clusterByAttribute(people, 'role'),
    bySegment: clusterByAttribute(people, 'segment'),
    // Later: ML-based persona clustering
  }

  return groups
}
```

### 3. Lens Application
```typescript
// New service: applyLens()
export async function applyLens(
  projectId: string,
  lensType: "product" | "sales" | "research"
) {
  const evidence = await getEvidence(projectId)
  const groups = await deriveUserGroups(projectId)

  switch (lensType) {
    case "product":
      return generatePainMatrix(evidence, groups)
    case "sales":
      return generateQualificationScorecard(evidence)
    case "research":
      return synthesizeResearchHierarchy(evidence)
  }
}
```

### 4. Theme Consolidation
```typescript
// Update autoGroupThemes with lens context
export async function autoGroupThemes(opts: {
  evidenceIds: string[]
  lensContext: string | null
  minEvidenceThreshold: number  // e.g., 3 for product, 1 for sales
}) {
  // ... existing BAML call ...

  // Post-process: filter themes below threshold
  const validThemes = themes.filter(t =>
    t.evidence_count >= opts.minEvidenceThreshold
  )

  // Consolidate similar themes
  const consolidated = consolidateSimilarThemes(validThemes, {
    similarityThreshold: 0.8
  })

  return consolidated
}
```

---

## UI Changes

### New: Lens Selector (Top-Level Navigation)
```
┌──────────────────────────────────────────────────────────┐
│  View as:  [Product PM] [Sales] [Researcher] [Support]  │
└──────────────────────────────────────────────────────────┘
```

### Product Lens View
```
Pain × User Type Matrix
─────────────────────────────────────────────────────
              Enterprise PM  SMB Designer  Developer
Pain A            🔥🔥🔥          🔥           —
Pain B            🔥🔥            🔥🔥🔥        🔥

[Below matrix]
Feature Backlog (sorted by impact)
1. Research Organization (Evidence: 12, Impact: High)
2. Insight Sharing (Evidence: 8, Impact: Medium)
```

### Sales Lens View
```
Opportunity: ACME Corp
─────────────────────────────────────
BANT Scorecard: 71% Qualified

[Qualification dimensions with evidence]
[Gap-closing actions]
[Stakeholder map]
```

### Research Lens View
```
Goal Progress Dashboard
─────────────────────────────────────
DQ1: What will users pay for? ✅ 82% answered
  └─ RQ1: Must-have features? ✅ 85%
  └─ RQ2: Price sensitivity? ✅ 78%

DQ2: Which segment to target? 🟡 45% partial
  └─ RQ3: Segment pain intensity? ✅ 80%
  └─ RQ4: Segment market size? ❌ 20%  ← Need more data
```

---

## Migration Path

### Phase 1: Foundation (Week 1-2)
- [ ] Add `willingness_to_pay` and `priority` to evidence facet extraction
- [ ] Create `deriveUserGroups()` service (rule-based)
- [ ] Update theme generation to accept `minEvidenceThreshold`
- [ ] Add theme consolidation post-processing

### Phase 2: Product Lens (Week 3-4)
- [ ] Build Pain × User Type matrix generator
- [ ] Create matrix UI component
- [ ] Add filtering controls (min evidence, min coverage)
- [ ] Generate feature backlog from matrix

### Phase 3: Sales Lens (Week 5-6)
- [ ] Build BANT/MEDDIC scorecard generator
- [ ] Create qualification UI
- [ ] Link to deal/opportunity records

### Phase 4: Lens Switcher (Week 7)
- [ ] Add top-level lens navigation
- [ ] Persist user's preferred lens
- [ ] Add lens-specific help/tooltips

---

## Open Questions to Discuss

1. **Group Derivation:** Should we start with rule-based (role/segment) or invest in clustering algorithms upfront?

2. **Lens Extensibility:** Should we allow users to define custom lenses with their own output formats?

3. **Theme Minimums:** What evidence thresholds make sense? (Proposed: Product=3, Sales=1, Research=2)

4. **Willingness to Pay:** How do we capture this reliably from evidence? Explicit mentions only or inference?

5. **Matrix Axes:** For Product lens, should we support swapping axes (e.g., Feature × User Type instead of Pain × User Type)?

6. **Research Lens Preservation:** Do we keep Goal/DQ/RQ hierarchy as-is, just make it one lens among many?

---

## Success Metrics

- **Evidence Reuse:** Same evidence powers multiple lenses (measure cross-lens evidence usage)
- **Time to Insight:** Reduce from "analyze evidence" to "actionable decision" (target: <5 min)
- **User Satisfaction:** Survey PM/Sales/Research roles separately on usefulness
- **Theme Quality:** Reduce theme count by 60% while maintaining coverage
- **Action Completion:** Track how many generated actions (features, deals, next questions) get executed

---

## Appendix: Example Data Flow

### Input: Interview with Enterprise PM
```
Interviewer: "What's your biggest challenge with research?"
PM: "I can't keep track of all our user interviews. They're scattered
     across Google Docs, Notion, Slack. I'd pay $50/month to fix this."
```

### Evidence Extraction
```typescript
{
  verbatim: "I can't keep track of all our user interviews...",
  facets: {
    pain: ["Research organization", "Tool fragmentation"],
    workflow: ["Uses Google Docs", "Uses Notion", "Uses Slack"],
    willingness_to_pay: "high",  // "$50/month"
    priority: "critical"  // "biggest challenge"
  },
  person_id: "person-123"
}
```

### Person Attributes
```typescript
{
  id: "person-123",
  name: "Sarah Chen",
  attributes: {
    role: "Product Manager",
    segment: "Enterprise",
    company_size: "500-1000",
    behaviors: ["Uses Notion", "Manages research program"]
  }
}
```

### Group Assignment (Derived)
```typescript
// Automatically placed in:
- Role: "Product Manager" (matches attribute)
- Segment: "Enterprise" (matches attribute)
- Persona: "Research Program Manager" (inferred from behaviors)
```

### Lens Outputs

**Product Lens:**
```
Pain Matrix Cell [Research Organization × Enterprise PM]
- Frequency: 80% (8/10 Enterprise PMs mention this)
- Intensity: Critical (based on priority facet)
- Willingness to Pay: High (median $45/mo from evidence)
- Evidence Count: 12 pieces
- Action: Prioritize "Research Hub" feature for Q1
```

**Sales Lens:**
```
Signal for ACME Corp Deal:
- Need: ✅ Confirmed ("biggest challenge")
- Budget: ✅ Strong ($50/mo willingness)
- Use Case: Research organization
- Next Step: Demo "Research Hub" feature
```

**Research Lens:**
```
RQ: "What research workflow pains exist?"
- Finding: "Research organization is critical pain (12 mentions, high confidence)"
- Evidence: [Link to this + 11 other pieces]

DQ: "What features should we build?"
- Strategic Insight: "Prioritize Research Hub to consolidate scattered tools"
- Confidence: High (85%)
```

---

## Next Steps

1. **Review & Discuss:** Does this lens-based approach solve your concerns?
2. **Prioritize Questions:** Which of the open questions should we answer first?
3. **Pick Starting Point:** Should we start with Product lens or refactor foundations first?
4. **Prototype:** Build a minimal Product lens matrix view to validate the approach?
