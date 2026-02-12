# Personal Touch AI - Beta Requirements & Decisions

**Feature:** Personal Touch AI - Personalized Survey Generation
**Phase:** Internal QA Beta (Early Access)
**Date:** February 11, 2026
**Team Review:** BMad Party Mode (John, Bob, Winston, Sally, Mary, Barry)
**Approved By:** Rick Moy

---

## Executive Decision Summary

**✅ APPROVED FOR IMMEDIATE BUILD**

1. **Scope:** Internal QA Beta with 13 test personas
2. **Timeline:** 2 weeks (10 days)
3. **Distribution:** CSV link export (no auto-email in beta)
4. **Evidence:** Auto-accept extraction (confidence > 0.6)
5. **Launch:** Ship as "Early Access" to internal team

---

## Requirements - LOCKED IN

### REQ-001: Survey Recommendation Trigger Logic
**Priority:** P0 (Deferred to Phase 2)

For Beta: Manual trigger only via "Generate Surveys" action on People List

### REQ-002: Question Generation Quality
**Priority:** P0

- System SHALL generate 5 personalized questions in < 5 seconds
- Questions SHALL reference person attributes naturally (not "Based on your profile...")
- Questions SHALL include clear rationale explaining "why this question for this person"
- Questions SHALL use conversational tone, open-ended format
- System SHALL handle sparse data (no facets/title) by generating discovery questions

**Quality Gate:**
- 80%+ questions rated "would send" by internal team
- 0% creepy/inappropriate phrasing
- 100% questions reference correct person attributes

### REQ-003: Survey Distribution Mechanism (Beta)
**Priority:** P0

- MUST support: Bulk generate personalized links → CSV download
- CSV SHALL include: Name, Email, Survey Link, Questions Preview (first question)
- Links SHALL be unique per person (personalized_for field)
- FUTURE (Phase 2): Auto-email via Gmail integration

### REQ-004: Evidence Quality Validation
**Priority:** P0

- Extracted evidence with confidence >= 0.6 SHALL be auto-accepted
- Evidence SHALL be created with same trust model as interview evidence
- Low confidence (< 0.6) SHALL still create evidence but log warning
- Users SHALL NOT need manual approval (same as interview pipeline)

### REQ-005: Theme Linking Accuracy
**Priority:** P1

- Evidence-to-theme linking with confidence >= 0.7 SHALL auto-link
- Confidence < 0.7 SHALL skip theme link (evidence exists, no theme)
- System SHALL track theme linking accuracy for prompt improvement

### REQ-006: MVP Validation Criteria
**Priority:** P0

**Week 1-2 Internal Testing:**
- Generate surveys for 13 test personas (5 rich + 5 sparse + 3 edge cases)
- Team quality review: 80%+ questions rated "relevant"
- Evidence extraction: 70%+ accuracy (manual validation)
- Performance: Generation < 5s per survey, < 30s for batch of 10

**Success Criteria:**
- All team members complete 1+ personalized survey
- Compare response quality vs generic survey baseline
- Gather feedback: "Would use in production?" > 80%

### REQ-007: Minimum Data Quality for Personalization
**Priority:** P0

Person record MUST have at least ONE of:
- `title` OR `job_function` populated
- 1+ `person_facet` record (pain/goal/workflow/tool)
- `person_scale` with `icp_score`

**If person has NONE:**
- Generate discovery questions focused on filling gaps
- Flag as "sparse_mode: true" in context
- Suggested goal: 'discover'

**If person has SOME data:**
- Generate questions leveraging available data
- Include gap-filling questions for missing fields

### REQ-008: Multi-Project Personalization Scope
**Priority:** P1

- Survey SHALL be scoped to SINGLE project
- Use `project_id` from current page context (person detail URL)
- Fetch project-specific themes, goals, research questions

### REQ-009: Survey Frequency & Deduplication
**Priority:** P2 (Deferred to Phase 2)

For Beta: No frequency limits, no deduplication (internal testing only)

### REQ-010: Theme Validation Thresholds
**Priority:** P1

- Target evidence count per theme: 5 pieces (configurable later)
- Confidence calculation:
  - LOW: evidence_count < 3 AND avg_confidence < 0.6
  - MEDIUM: evidence_count >= 3 OR avg_confidence >= 0.6
  - HIGH: evidence_count >= 5 AND avg_confidence >= 0.7

### REQ-011: Design System Consistency
**Priority:** P0

- All components SHALL use shadcn/ui + Tailwind
- SHALL support dark mode (dark:* variants)
- SHALL match existing person detail Phase 1 redesign (Insights-gq42)
- SHALL use existing component patterns (StatChip, Badge)

### REQ-012: Evidence Processing Reliability
**Priority:** P0

- Survey completion SHALL trigger via Supabase webhook on `research_link_responses` INSERT
- Fallback: Hourly batch job for unprocessed surveys
- Retry policy: Max 3 retries with exponential backoff (1min, 5min, 15min)
- After 3 failures: Log error, continue (don't block other extractions)
- Monitoring: Log extraction success/failure rates

---

## User Stories - Sprint Backlog

### Story B1.1: BAML Question Generation (5 pts)
**Bead:** Insights-j4lr
**Assignee:** Barry
**Status:** Blocked by Insights-4l9y (migrations)

**Implementation:**
```
File: baml_src/personalized_survey.baml

Tasks:
□ Define PersonContext class (name, title, company, role, facets, icp_score, etc.)
□ Define ProjectContext class (research_goals, themes_needing_validation)
□ Define SurveyGoal, PersonalizedQuestion classes
□ Implement GeneratePersonalizedQuestions function (GPT-4)
□ Prompt engineering: conversational tone, avoid creepy phrasing
□ Unit tests: Mock 5 persona types (VP, IC, Founder, sparse, edge case)

Acceptance Criteria:
✅ Generates 5 questions in < 5 seconds
✅ Questions reference person attributes naturally
✅ Rationale explains "why this question"
✅ No creepy/awkward phrasing (team review)
✅ Handles sparse data (title-only person)
```

### Story B1.2: Person Context Fetcher (3 pts)
**Bead:** Insights-vxh7
**Assignee:** Barry
**Status:** Blocked by Insights-4l9y (migrations)

**Implementation:**
```
File: app/features/research-links/utils/personalization.server.ts

Tasks:
□ Implement fetchPersonContext with parallel queries
□ Create get_person_top_themes RPC call
□ Handle missing fields gracefully (sparse data)
□ Extract facets into PersonFacets object
□ Identify missing fields for gap questions

Acceptance Criteria:
✅ Performance < 200ms p95
✅ Handles person with 0 facets (uses title + ICP only)
✅ Handles person with 100+ evidence (limits to top 5 themes)
✅ Returns complete PersonContext object
```

### Story B1.3: Quick View Carousel Component (5 pts)
**Bead:** Insights-fhsj
**Assignee:** Barry

**Implementation:**
```
File: app/features/research-links/components/SurveyQuickView.tsx

Tasks:
□ Carousel UI with person context + questions
□ Keyboard navigation (arrow keys, spacebar)
□ Approve/Skip/Edit actions
□ Progress indicator (visual dots)
□ Collapse/expand questions (show first 3, expand for all)
□ Bulk actions: "Approve All Remaining"

Acceptance Criteria:
✅ Arrow keys navigate between surveys
✅ Spacebar approves current + advances
✅ Edit opens inline textarea
✅ Progress shows X/Y approved
✅ Smooth transitions (Framer Motion)
```

### Story B1.4: Bulk Generate from People List (3 pts)
**Bead:** Insights-l9ic
**Assignee:** Barry

**Implementation:**
```
File: app/features/people/pages/index.tsx

Tasks:
□ Multi-select checkboxes on people list
□ "Generate Surveys" action in bulk actions dropdown
□ Parallel generation (Promise.all) for selected people
□ Open SurveyQuickView with results
□ Error handling: Skip failed, show successful

Acceptance Criteria:
✅ Select 10 people → Generate 10 surveys
✅ Parallel generation completes < 30s
✅ Failed generations show error, don't block others
✅ Loading indicator during generation
```

### Story B2.1: Survey-to-Evidence Pipeline (5 pts)
**Bead:** Insights-nm2t
**Assignee:** Barry
**Status:** Blocked by Insights-j4lr (needs BAML)

**Implementation:**
```
File: src/trigger/research-links/processSurveyCompletion.ts

Tasks:
□ Create Trigger.dev task triggered on survey completion
□ BAML function: ExtractEvidenceFromAnswer
□ Create evidence records (gist, category, confidence)
□ Link to person_attribution
□ Auto-link to themes (confidence > 0.7)
□ Handle failures gracefully (log, continue)

Acceptance Criteria:
✅ Survey completion → Evidence created < 30s
✅ Extracts 3-5 evidence pieces per survey
✅ Auto-accepts confidence >= 0.6
✅ Links to correct themes (manual validation)
✅ Retry logic: Max 3 attempts
```

### Story B2.2: CSV Link Export (2 pts)
**Bead:** Insights-m5a9
**Assignee:** Barry

**Implementation:**
```
File: app/features/research-links/utils/export.server.ts

Tasks:
□ Generate CSV with columns: Name, Email, Survey Link, Questions Preview
□ Personalized link for each approved survey
□ Download as research-surveys-{date}.csv
□ Include first question as preview

Acceptance Criteria:
✅ CSV includes all approved surveys from QuickView
✅ Links work when clicked (test 3 links)
✅ Questions preview shows first question text
✅ File downloads correctly
```

### Story B2.3: Timeline Integration (3 pts)
**Bead:** Insights-njav
**Assignee:** Barry

**Implementation:**
```
File: app/features/people/components/SurveyTimelineEvent.tsx

Tasks:
□ SurveyTimelineEvent component
□ Status display: Sent → Opened → Completed
□ Evidence extraction summary on completion
□ Link to view responses
□ Integrate into Activity Timeline section

Acceptance Criteria:
✅ Survey appears in timeline after sending
✅ Status updates real-time (polling or webhook)
✅ "3 evidence pieces extracted" shown on completion
✅ Clicking evidence summary navigates to evidence list
```

### Story B0.1: Database Migrations (PREREQUISITE)
**Bead:** Insights-4l9y
**Assignee:** Barry
**Status:** IN PROGRESS

**Implementation:**
```
File: supabase/migrations/YYYYMMDDHHMMSS_personalization_beta.sql

Tasks:
□ ALTER research_links: Add personalized_for, survey_goal, generation_metadata
□ ALTER research_link_responses: Add evidence_extracted, evidence_count
□ CREATE FUNCTION get_person_top_themes(person_id, limit)
□ Run migration: pnpm db:migrate
□ Verify: Query tables to confirm columns exist

Acceptance Criteria:
✅ Migration runs without errors
✅ All new columns exist
✅ RPC function works: SELECT * FROM get_person_top_themes('uuid', 5)
✅ No breaking changes to existing queries
```

---

## Architecture Decisions - FINAL

### Data Fetching: Optimized Parallel Queries

**Pattern:**
```typescript
// Parallel queries instead of nested joins
const [person, facets, icpScore, themes] = await Promise.all([
  supabase.from('people').select('*').eq('id', personId).single(),
  supabase.from('person_facet').select('*').eq('person_id', personId),
  supabase.from('person_scale').select('*').eq('person_id', personId).eq('kind_slug', 'icp_match').single(),
  supabase.rpc('get_person_top_themes', { p_person_id: personId, p_limit: 5 })
])
```

**Rationale:** Avoids N+1 queries, limits data to top 5 themes only

### BAML Caching: 7-Day TTL

**Pattern:**
```typescript
const cacheKey = `survey:${personId}:${surveyGoal}:${hash(personContext)}`
const cached = await getCachedQuestions(cacheKey, maxAge: '7 days')
if (cached && !forceRegenerate) return cached

const questions = await GeneratePersonalizedQuestions(...)
await cacheQuestions(cacheKey, questions, ttl: '7 days')
```

**Rationale:** Reduces BAML costs, improves regeneration speed

### Evidence Extraction: Auto-Accept (Same as Interviews)

**Pattern:**
```typescript
for (const answer of surveyResponses) {
  const extracted = await ExtractEvidenceFromAnswer(...)

  if (extracted.confidence >= 0.6) {
    await createEvidence(extracted) // Auto-accept
  } else {
    console.warn('Low confidence extraction', { confidence: extracted.confidence })
    // Still create evidence, mark low confidence
  }
}
```

**Rationale:** Survey responses trusted like interview evidence, no manual review needed

### Sparse Data Handling: Discovery Mode

**Pattern:**
```typescript
function buildPersonContext(person) {
  const hasSufficientData = person.title || person.person_facet?.length > 0 || person.person_scale?.icp_score

  if (!hasSufficientData) {
    return {
      ...person,
      sparse_mode: true,
      suggested_goal: 'discover' // Focus on gap-filling
    }
  }

  return buildFullContext(person)
}
```

**Rationale:** Gracefully handles low-quality person records, generates discovery questions

### Quick View: Carousel Pattern

**UX Pattern:** Single modal with prev/next navigation, approve/skip actions
**Tech:** React state for current index, keyboard event listeners
**Performance:** Lazy-load questions (don't render all 10 surveys at once)

---

## Test Plan - Internal QA

### Test Dataset (13 Personas)

**High-Quality Personas (5):**
1. VP Engineering, Series B SaaS, 5 interviews, 8 facets, ICP: Strong
2. Product Manager, Enterprise, 3 interviews, 6 facets, ICP: Moderate
3. Founder, Seed stage, 4 interviews, 10 facets, ICP: Strong
4. Designer, Mid-market, 2 interviews, 4 facets, ICP: Weak
5. Data Analyst, Enterprise, 6 interviews, 7 facets, ICP: Moderate

**Sparse Personas (5):**
1. Title only: "CTO" (no facets, no interviews, no ICP)
2. Title + Company: "VP Product @ Acme" (no facets)
3. Facets only: 3 pain points, no title
4. ICP only: Score 0.85, no title, no facets
5. Recent import: Name + Email only (added today)

**Edge Cases (3):**
1. 10+ interviews, 15 facets, 5+ themes (rich data overload)
2. No data except name (pure discovery)
3. Multiple projects, different themes per project

### Quality Metrics

**Question Relevance:**
- Manual review by 3 team members
- Rating scale: Would send (yes/no/maybe)
- Target: 80%+ "yes" votes

**Evidence Extraction:**
- Complete 5 test surveys
- Compare auto-extracted evidence vs manual review
- Target: 70%+ accuracy (correct gist + category + theme link)

**Performance:**
- Single survey generation: < 5s
- Batch 10 surveys: < 30s
- Evidence extraction: < 30s after completion

---

## UX Flows - Complete

### Flow 1: Bulk Survey Generation

```
1. User on People List page
2. Select 10 people via checkboxes
3. Click [Actions ▾] → "Generate Personalized Surveys"
4. Loading indicator: "Generating 10 surveys..."
5. QuickView modal opens with first survey
6. User reviews: [< Prev] [Next >] [Approve] [Skip] [Edit]
7. Keyboard: Arrow keys navigate, Spacebar approves
8. Progress indicator: ✅✅✅⏸️⏸️⏸️⏸️⏸️⏸️⏸️ (3/10 approved)
9. After reviewing all: Click "Generate Links (8)"
10. CSV downloads: research-surveys-2026-02-11.csv
11. User opens CSV, copies links, pastes into email client
```

### Flow 2: Survey Completion → Evidence

```
1. Recipient receives email with personalized link
2. Clicks link → Research link page opens
3. Completes 5 questions, submits
4. Webhook triggers processSurveyCompletion task
5. BAML extracts evidence from each answer
6. Evidence records created (3-5 pieces)
7. Auto-linked to themes (confidence > 0.7)
8. Person timeline updates: "✅ Survey completed! 3 evidence pieces extracted"
9. User clicks "View Evidence" → navigates to evidence list filtered by this survey
```

### Flow 3: Quick View Carousel Interactions

```
[Initial State]
- Modal shows Sarah Chen (1/10)
- 5 questions displayed (first 3 visible, "Show 2 more...")
- Actions: [Approve] [Skip] [Edit]

[User clicks Edit on Q2]
- Q2 expands to textarea
- User modifies text
- Option: "Keep rationale? ☑️ Yes"
- [Cancel] [Save Changes]

[User clicks Regenerate]
- Loading: "Regenerating questions..."
- New 5 questions appear
- Regenerate count: "Regenerate (2 left)"

[User presses Spacebar]
- Survey approved
- Auto-advance to Mike Jones (2/10)
- Progress: ✅⏸️⏸️⏸️⏸️⏸️⏸️⏸️⏸️⏸️

[User completes review]
- 8 approved, 2 skipped
- "Generate Links (8)" button active
- Click → CSV download
```

---

## Open Questions - RESOLVED

### Q1: Pricing Strategy?
**Decision:** Not applicable for beta (internal only)

### Q2: Send Mechanism?
**Decision:** CSV export for beta, Gmail integration in Phase 2

### Q3: Recommendation Trigger?
**Decision:** Manual trigger only (bulk action on People List), auto-recommendations in Phase 2

### Q4: Edit vs Trust?
**Decision:** Preview with edit capability, users CAN modify before sending

### Q5: Evidence Review?
**Decision:** Auto-accept (confidence > 0.6), same trust as interview evidence

---

## Next Steps - EXECUTING NOW

**✅ Barry started:** Database migrations (Insights-4l9y)
**⏳ Rick reviewing:** After dinner, review progress
**📋 Bob tracking:** Sprint board ready, beads created
**🚀 Target:** Beta ready in 10 days (2 weeks)

---

**END OF REQUIREMENTS - LOCKED & APPROVED**
