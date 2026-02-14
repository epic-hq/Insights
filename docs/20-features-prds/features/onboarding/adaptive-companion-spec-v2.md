# Adaptive Companion V2 - Lens-Powered Research Assistant

> **Status:** Ready for Implementation
> **Builds On:** Adaptive Companion V1, Lens Architecture V2, Unified Research Flow
> **Unique Advantages:** Evidence clips, Semantic clustering, 65+ Mastra tools, Voice-first

## What Makes This Different

**Competitors show you forms.** We show you a research partner that:
- Understands research frameworks (BANT, Jobs-to-be-Done, Empathy Maps)
- Creates timestamped evidence clips from voice/video
- Clusters insights semantically (not keyword matching)
- Automates CRM/survey operations with 65+ integrated tools
- Lets you switch lenses without re-processing data

---

## The One-Question Entry

**"What do you want to learn about your customers?"**

System detects intent and recommends a lens:

```
User: "I need to qualify enterprise deals"
Agent: "Got it - sales qualification. I'll use the BANT lens to structure this.
        We'll track Budget, Authority, Need, and Timeline for each prospect.

        First, tell me about your typical deal - what's being sold?"

[Captured Panel shows: BANT Lens selected ✓]
```

---

## Two-Pane Layout with Lens Context

```
┌─────────────────────────────────────────────────────────────────┐
│  Set up your research                           [BANT Lens ▼]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─ Chat ────────────────────────┬─ Captured (BANT) ─────────┐ │
│  │                               │                            │ │
│  │  Agent: "Who should we talk   │  Research Goal ✓           │ │
│  │  to for qualification?"       │  ┌──────────────────────┐  │ │
│  │                               │  │ Qualify enterprise   │  │ │
│  │  You: "VPs and C-level at     │  │ SaaS deals          │  │ │
│  │  companies with 100+ employees"│  └──────────────────────┘  │ │
│  │                               │                            │ │
│  │  Agent: "Perfect. BANT will   │  Target Roles ✓            │ │
│  │  focus on Budget, Authority,  │  • VP Engineering          │ │
│  │  Need, and Timeline during    │  • CTO                     │ │
│  │  discovery interviews."       │  • VP Product              │ │
│  │                               │                            │ │
│  │  [+ Voice Interview]          │  BANT Scorecard            │ │
│  │  [+ Create Survey]            │  ┌──────────────────────┐  │ │
│  │  [+ Upload Recording]         │  │ Budget:    [─────]   │  │ │
│  │                               │  │ Authority: [─────]   │  │ │
│  │  [🎤] [⌨️]                    │  │ Need:      [─────]   │  │ │
│  │                               │  │ Timeline:  [─────]   │  │ │
│  └───────────────────────────────┴─│ (Fills as you talk)  │  │ │
│                                    └──────────────────────┘  │ │
│                                                               │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Available Lenses

| Lens | Use Case | What It Extracts | Output Format |
|------|----------|------------------|---------------|
| **BANT** | Sales qualification | Budget, Authority, Need, Timeline | Scorecard + Deal matrix |
| **JTBD** | Product discovery | Job, Outcome, Constraint, Current solution | Jobs canvas |
| **Empathy Map** | User research | Says, Thinks, Does, Feels | Empathy map quadrants |
| **Problem-Solution** | Product-market fit | Pain intensity, Current workaround, Willingness to pay | Pain × Segment matrix |
| **Research** | Academic/formal | Goal, DQ, RQ, Hypothesis | Research hierarchy |
| **Support** | Customer success | Issue type, Frequency, Severity, Impact | Issue × Segment matrix |

**User chooses or agent recommends based on stated goal.**

---

## Voice → Evidence Clips → Lens Analysis

### The Magic Moment

```
User: [Clicks 🎤 Voice Interview]

Agent: "I'm recording. Tell me about your last conversation with [Prospect Name]."

User: "Yeah, so the CTO said their current tool costs $50K annually
       and they're frustrated with the reporting. He mentioned he has
       final say on vendor selection..."

[Real-time transcription appears in chat]

[Captured Panel updates live:]
  BANT Scorecard
  ├─ Budget: $50K+ ✓ (High)
  │  └─ 🎥 Evidence: "costs $50K annually" [0:08]
  ├─ Authority: Decision maker ✓
  │  └─ 🎥 Evidence: "final say on vendor selection" [0:23]
  ├─ Need: Validated ✓
  │  └─ 🎥 Evidence: "frustrated with reporting" [0:15]
  └─ Timeline: [Not captured yet]

Agent: "Great signal! Did they mention when they need to make a decision?"
```

### Evidence Clip Format

```typescript
{
  id: "evidence_abc123",
  verbatim: "costs $50K annually",
  source: {
    interview_id: "int_xyz",
    person_id: "person_123",
    anchor: {
      type: "audio" | "video",
      timestamp: 8.5,  // seconds
      duration: 3.2,
      url: "signed_url_to_clip"
    }
  },
  lens_facets: {
    bant_slot: "budget",
    confidence: 0.95,
    extracted_value: { amount: "$50K", period: "annual" }
  }
}
```

**Every piece of evidence links back to the exact moment in audio/video.**

---

## Lens-Driven Question Generation

Instead of generic questions:

```
❌ Generic: "Tell me about your decision process"

✅ BANT Lens:
   "Who else needs to approve this purchase?" (Authority)
   "What's your budget range for this solution?" (Budget)
   "When do you need this in place?" (Timeline)

✅ JTBD Lens:
   "What job were you trying to accomplish when you hit this problem?"
   "What outcome would make this successful for you?"
   "What's stopping you from solving this today?"
```

**Questions generated from lens + context + existing evidence gaps.**

---

## Semantic Theme Clustering (Not Keyword Matching)

As evidence accumulates, themes emerge:

```
Evidence: "costs $50K annually", "budget is tight", "need ROI justification"
         ↓ Semantic clustering
Theme: "Price sensitivity" (3 mentions across 2 interviews)
      ├─ Segment: Enterprise (2 mentions)
      └─ Segment: Mid-market (1 mention)

NOT keyword matching:
  "budget" → "Budget concerns"  ❌

BUT semantic understanding:
  "costs $50K", "tight budget", "need ROI" → Same underlying concern ✓
```

**Uses embeddings + LLM to group conceptually similar evidence, not exact phrases.**

---

## 65+ Mastra Tools = Deep Automation

### What Happens After Setup

```
User: "Looks good, let's start collecting data"

Agent: [Uses tools automatically]
  ✓ createSurvey({ questions, lens: "bant" })
  ✓ generateInterviewGuide({ lens: "bant", target_roles })
  ✓ upsertPeople({ contacts: extracted_from_crm })
  ✓ createOpportunities({ deals: identified_in_conversation })
  ✓ fetchConversationLenses() → Shows BANT matrix

Returns:
  "Created 3 things:
   • Survey: /survey/abc123 (ready to share)
   • Interview guide: 10 BANT questions
   • CRM: Added 5 prospects with preliminary BANT scores"
```

### Tool Categories

| Category | Example Tools | Count |
|----------|---------------|-------|
| **CRM** | upsert-person, manage-organizations, create-opportunity | 12 |
| **Surveys** | create-survey, fetch-survey-responses, analyze-nps | 8 |
| **Evidence** | semantic-search-evidence, fetch-themes, cluster-insights | 10 |
| **Lenses** | fetch-bant-scorecard, generate-pain-matrix, analyze-jtbd | 7 |
| **Analysis** | recommend-next-actions, identify-segments, score-deals | 9 |
| **Content** | generate-interview-questions, create-outreach-email | 6 |
| **Data** | save-table-to-assets, export-to-csv, manage-documents | 5 |
| **Research** | web-research, company-enrichment, competitor-analysis | 8 |

**Total: 65+ tools** (and growing)

---

## Real-Time Lens Views

### BANT Lens Matrix (Live Updates)

```
┌─────────────────────────────────────────────────┐
│  BANT Qualification Matrix                      │
│                                                  │
│         Low Authority    High Authority         │
│  High  ┌──────────────┬──────────────┐         │
│  Budget│   Warm       │   Hot        │         │
│        │   • Deal A   │   • Deal C ✓ │  ← Just added
│        └──────────────┴──────────────┘         │
│  Low   ┌──────────────┬──────────────┐         │
│  Budget│   Cold       │   Nurture    │         │
│        │   • Deal B   │              │         │
│        └──────────────┴──────────────┘         │
│                                                  │
│  Click any cell to see supporting evidence      │
└─────────────────────────────────────────────────┘
```

**Updates in real-time as evidence is extracted during voice/text conversation.**

---

## Competitive Advantages (Summary)

| Feature | Competitors | Us |
|---------|-------------|-----|
| **Evidence Traceability** | Text tags | Video/audio clips with timestamps |
| **Analysis Frameworks** | One-size-fits-all | Multiple lenses (BANT, JTBD, etc.) |
| **Theme Detection** | Keyword matching | Semantic clustering via embeddings |
| **Automation** | Manual workflows | 65+ tools for CRM/surveys/analysis |
| **Voice Integration** | Upload-only | Real-time voice → evidence extraction |
| **Lens Switching** | Re-tag everything | Same data, different views |

---

## User Journeys

### Journey 1: Sales Manager (BANT Lens)

```
Entry: "I need to qualify our Q1 pipeline"
  ↓
Setup (2 min): BANT lens selected, target roles captured
  ↓
Action: Voice record discovery call with prospect
  ↓
Real-time: BANT scorecard fills as they talk
  ↓
Output: Deal classified as "Hot" (high budget + authority)
  ↓
Next: Agent suggests: "Want to create a proposal template for hot deals?"
```

### Journey 2: Product Manager (JTBD Lens)

```
Entry: "We're exploring a new feature idea"
  ↓
Setup: JTBD lens selected, user segments defined
  ↓
Action: Upload 5 user interview recordings
  ↓
Processing: Extract jobs, outcomes, constraints from all 5
  ↓
Output: Jobs canvas showing top 3 jobs × 4 user types
  ↓
Next: "3 jobs have high willingness to pay. Create validation survey?"
```

### Journey 3: Researcher (Multi-Lens)

```
Entry: "I'm doing discovery research"
  ↓
Setup: Research lens (Goal → DQ → RQ), then switch to Empathy Map
  ↓
Action: Mix of interviews, surveys, uploaded docs
  ↓
Analysis: View same evidence through both lenses
  ↓
Output: Research hierarchy + Empathy map quadrants
  ↓
Next: "Found contradiction between what users say vs do. Investigate?"
```

---

## Integration with Existing Architecture

### Builds On
- **Lens Architecture V2** (`docs/00-foundation/_lens-based-architecture-v2.md`)
- **Mastra Agents** (`projectSetupAgent` for chat, `projectStatusAgent` for orchestration)
- **Evidence System** (existing `evidence` table with facets)
- **BAML Extraction** (structured output contracts)

### New Components
1. **Lens Selector** - UI for choosing/switching lenses
2. **Live Lens Panel** - Right-side panel showing lens-specific views (scorecard, matrix, canvas)
3. **Voice → Evidence Pipeline** - Real-time extraction during recording
4. **Semantic Clustering** - Embeddings-based theme detection
5. **Evidence Clip Player** - Click evidence → jump to video/audio timestamp

---

## Implementation Phases

### Phase 1: Lens-Aware Setup (Week 1)
- [ ] Lens selection in adaptive companion
- [ ] Lens-specific captured fields (BANT scorecard, JTBD canvas, etc.)
- [ ] Agent recommends lens based on stated goal

### Phase 2: Evidence Clips (Week 2)
- [ ] Voice recording with real-time transcription
- [ ] Timestamp anchors on evidence
- [ ] Click evidence → play audio/video clip
- [ ] Visual timeline of evidence extraction

### Phase 3: Live Lens Views (Week 3)
- [ ] BANT matrix updates during conversation
- [ ] JTBD canvas fills as jobs are mentioned
- [ ] Empathy map quadrants populate from evidence
- [ ] Switch lens → re-analyze same data

### Phase 4: Semantic Clustering (Week 4)
- [ ] Embedding-based theme detection
- [ ] Cross-evidence semantic similarity
- [ ] Lens-contextualized themes (same evidence, different themes per lens)
- [ ] Minimum evidence thresholds per lens

### Phase 5: Tool Automation (Week 5)
- [ ] Auto-create survey from lens + gaps
- [ ] Auto-generate interview guide from lens
- [ ] Auto-populate CRM from conversation
- [ ] Proactive recommendations using chiefOfStaffAgent

---

## Success Metrics

| Metric | Current | Target | Why It Matters |
|--------|---------|--------|----------------|
| Setup completion | 40% | 80% | More users reach value |
| Time to first insight | 30 min | 3 min | WOW moment during first interview |
| Evidence with clips | 0% | 70% | Video traceability = trust |
| Lens switching | 0% | 40% | Same data, multiple perspectives |
| Voice usage | 0% | 35% | Faster than typing |
| Tool automation rate | 10% | 60% | CRM/surveys auto-populated |

---

## Open Questions

1. **Lens complexity:** Start with 3 lenses (BANT, JTBD, Research) or all 6?
2. **Voice quality:** What's acceptable transcription accuracy? (Current: 95%+)
3. **Semantic clustering:** Minimum evidence count before clustering? (Suggest: 10)
4. **Video storage:** R2 signed URLs for clips, or stream from original?
5. **Mobile voice:** Default to voice on mobile, text on desktop?
6. **Lens mixing:** Allow multiple lenses on same project, or enforce one?

---

## Wireframes (To Create)

### Priority Wireframes Needed
1. **Lens selector modal** - Choose/switch lens with preview
2. **Live BANT scorecard panel** - Updates during voice
3. **Evidence clip player** - Timeline + transcript with highlights
4. **Semantic theme clusters** - Visual grouping of related evidence
5. **Multi-lens comparison view** - Same evidence, two lenses side-by-side
6. **Voice recording UI** - VoiceOrb + live transcription + evidence extraction

### Diagram Types
- Mermaid flowchart: User journey with lens selection
- Component hierarchy: Adaptive companion + lens panel architecture
- Data flow: Voice → Transcript → Evidence → Lens facets → Theme clusters
- Lens comparison: BANT vs JTBD viewing same interview

---

## Next Steps Before Implementation

1. **Create detailed wireframes** for all 6 priority screens
2. **Define lens switching logic** (re-process or cached?)
3. **Design semantic clustering algorithm** (embeddings model, threshold)
4. **Plan evidence clip storage** (R2 structure, signed URL expiry)
5. **Spec voice recording flow** (permissions, live feedback, stop/save)
6. **Commit current work** and create feature branch

---

## Appendix: Tool Inventory

<details>
<summary>View all 65+ Mastra tools</summary>

### CRM (12 tools)
- upsert-person, manage-people, fetch-people-details
- manage-organizations, fetch-organizations
- create-opportunity, update-opportunity, fetch-opportunities
- create-task, update-task, fetch-tasks
- link-interview-to-opportunity

### Surveys (8 tools)
- create-survey, update-survey, delete-survey
- fetch-surveys, search-survey-responses
- analyze-nps, analyze-csat
- generate-survey-from-themes

### Evidence (10 tools)
- semantic-search-evidence, fetch-evidence
- fetch-themes, cluster-themes
- fetch-personas, infer-segment
- fetch-pain-matrix-cache
- analyze-theme-strength
- identify-contradictions

### Lenses (7 tools)
- fetch-conversation-lenses
- fetch-bant-scorecard
- generate-pain-matrix
- analyze-jtbd-jobs
- generate-empathy-map
- analyze-research-questions

### Analysis (9 tools)
- recommend-next-actions
- identify-segments
- score-deal-qualification
- detect-churn-risk
- prioritize-features
- find-gaps-in-coverage
- analyze-persona-distribution
- calculate-theme-confidence

### Content (6 tools)
- generate-interview-questions
- generate-field-suggestions
- create-outreach-email
- suggest-next-steps
- display-user-questions

### Data (5 tools)
- save-table-to-assets
- manage-documents
- generate-document-link
- export-to-csv

### Research (8 tools)
- web-research, fetch-web-content
- research-company-website
- save-account-company-context
- generate-research-structure
- save-project-sections-data
- fetch-project-goals

</details>
